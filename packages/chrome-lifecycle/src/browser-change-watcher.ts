import type {
  BrowserChangeEvent,
  BrowserChangeHandler,
  BrowserChangeReason,
  BrowserChangeWatcher,
  BrowserChangeWatcherOptions,
} from './types';
import { isWindowSidePanelVisible, onSidePanelShown } from './sidepanel-state-manager';

const DEFAULT_DEBOUNCE_MS = 500;

interface DispatchOptions {
  /** See {@link BrowserChangeEvent.isPanelReload}. */
  isPanelReload?: boolean;
}

/**
 * Watches what the side panel is looking at and announces every change.
 *
 * Nothing feature-specific lives here: the browser listeners, the debounce and the
 * "have we already said this" bookkeeping are shared by every consumer, so they are
 * done once and the result handed to whoever registered. Features register a
 * handler instead of wiring their own tab listeners.
 *
 * The watcher does not know how the panel reports its view — call
 * {@link BrowserChangeWatcher.setView} from wherever that arrives.
 *
 * @example
 * ```typescript
 * const { onBrowserChange, setView } = createBrowserChangeWatcher({
 *   defaultView: 'insights',
 * });
 *
 * sidePanelTabChange.onMessage(setView);
 * ```
 */
export function createBrowserChangeWatcher<TView>(
  options: BrowserChangeWatcherOptions<TView>,
): BrowserChangeWatcher<TView> {
  const { defaultView, debounceMs = DEFAULT_DEBOUNCE_MS } = options;

  const handlers = new Set<BrowserChangeHandler<TView>>();

  let currentView = defaultView;
  let lastUrl: string | undefined;
  let lastTabId: number | undefined;
  let isDisposed = false;
  let pendingDispatch: ReturnType<typeof setTimeout> | undefined;

  function cancelPendingDispatch() {
    if (pendingDispatch) {
      clearTimeout(pendingDispatch);
      pendingDispatch = undefined;
    }
  }

  /**
   * Fans one change out to every handler. Handlers belong to unrelated features, so
   * one that throws must not keep the rest from running. The failure is logged
   * rather than swallowed: a silent bail here looks exactly like a side panel that
   * refuses to refresh.
   */
  async function emit(event: BrowserChangeEvent<TView>): Promise<void> {
    await Promise.all(
      [...handlers].map(async (handler) => {
        try {
          await handler(event);
        } catch (error) {
          console.error('[browser-change] A change handler failed', error);
        }
      }),
    );
  }

  async function dispatch(
    tabId: number,
    url: string,
    reason: BrowserChangeReason,
    dispatchOptions: DispatchOptions = {},
  ): Promise<void> {
    if (isDisposed) {
      return;
    }

    try {
      const tab = await chrome.tabs.get(tabId);

      if (!tab.active) {
        return;
      }

      // `chrome.tabs.onUpdated` fires repeatedly through a single navigation, so a
      // page is only announced once. The tab is part of that key because two tabs
      // can sit on the same URL, and handlers act per tab.
      if (reason === 'page' && lastTabId === tabId && lastUrl === url) {
        return;
      }

      const previousTabId = lastTabId ?? null;

      // Only a page event marks a page as announced. A view change says nothing
      // about the page, so letting it claim the current URL would swallow the
      // navigation that is still on its way through the debounce.
      if (reason === 'page') {
        lastTabId = tabId;
        lastUrl = url;
      }

      await emit({
        reason,
        tabId,
        url,
        windowId: tab.windowId,
        tab,
        view: currentView,
        previousTabId,
        isPanelReload: dispatchOptions.isPanelReload === true,
      });
    } catch (error) {
      console.error('[browser-change] Failed to read the tab that changed', error);
    }
  }

  async function onTabChange(
    tabId: number,
    tabOptions: DispatchOptions & { immediate?: boolean } = {},
  ): Promise<void> {
    if (isDisposed) {
      return;
    }

    const tab = await chrome.tabs.get(tabId);

    // Background tabs update constantly — a favicon, a title, a frame that finished
    // loading. They share one debounce with the tab the user is actually on, so
    // letting them through here would cancel a real navigation that is still
    // waiting to be announced, and then bail on the `active` check in `dispatch`.
    if (!tab.active) {
      return;
    }

    if (!isWindowSidePanelVisible(tab.windowId)) {
      return;
    }

    const { url } = tab;

    if (url == null) {
      return;
    }

    cancelPendingDispatch();

    if (tabOptions.immediate === true) {
      await dispatch(tabId, url, 'page', tabOptions);
      return;
    }

    pendingDispatch = setTimeout(() => {
      pendingDispatch = undefined;
      dispatch(tabId, url, 'page', tabOptions).catch(console.error);
    }, debounceMs);
  }

  /** Re-runs the active tab of `windowId` through the normal page flow. */
  function refreshActiveTab(
    windowId: number,
    refreshOptions: DispatchOptions = {},
  ): void {
    chrome.tabs
      .query({ windowId, active: true })
      .then(async (tabList) => {
        const activeTab = tabList[0];

        if (activeTab?.id == null) {
          return;
        }

        await onTabChange(activeTab.id, { ...refreshOptions, immediate: true });
      })
      .catch(console.error);
  }

  /**
   * Announces a view change against whatever tab the user is looking at. The panel
   * reporting the view carries no window of its own, so it is taken to be the one in
   * the window that currently has focus.
   */
  function announceViewChange(): void {
    chrome.tabs
      .query({ active: true, lastFocusedWindow: true })
      .then(async (tabList) => {
        const activeTab = tabList[0];

        if (activeTab?.id == null || activeTab.url == null) {
          return;
        }

        if (!isWindowSidePanelVisible(activeTab.windowId)) {
          return;
        }

        await dispatch(activeTab.id, activeTab.url, 'view');
      })
      .catch(console.error);
  }

  function handleTabUpdated(tabId: number): void {
    onTabChange(tabId).catch(console.error);
  }

  function handleTabActivated(activeInfo: chrome.tabs.OnActivatedInfo): void {
    // A tab can be gone by the time this runs, and that is not worth logging.
    onTabChange(activeInfo.tabId).catch(() => {});
  }

  chrome.tabs.onUpdated.addListener(handleTabUpdated);
  chrome.tabs.onActivated.addListener(handleTabActivated);

  const unsubscribeShown = onSidePanelShown(({ reason, windowId }) => {
    if (isDisposed) {
      return;
    }

    if (reason === 'document-load') {
      // A brand new panel document starts on its default view, so drop whatever the
      // previous document last reported instead of waiting for its first message.
      currentView = defaultView;
    }

    // The panel is back on screen, and its state is whatever it was before it went
    // away, so re-run the active tab through the normal flow instead of leaving
    // stale views up.
    lastUrl = undefined;
    lastTabId = undefined;
    refreshActiveTab(windowId, { isPanelReload: reason === 'document-load' });
  });

  return {
    onBrowserChange(handler) {
      handlers.add(handler);

      return () => {
        handlers.delete(handler);
      };
    },

    setView(view) {
      // The panel usually reports its view on mount as well as on a change, so only
      // a real move is announced.
      if (isDisposed || currentView === view) {
        return;
      }

      currentView = view;
      announceViewChange();
    },

    dispose() {
      isDisposed = true;
      cancelPendingDispatch();
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
      chrome.tabs.onActivated.removeListener(handleTabActivated);
      unsubscribeShown();
      handlers.clear();
    },
  };
}
