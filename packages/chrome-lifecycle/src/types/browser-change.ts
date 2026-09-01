/**
 * What moved under the side panel.
 *
 * - `page` — the active tab navigated, the user switched to another tab, or the
 *   panel came back on screen and needs to be told what it is looking at.
 * - `view` — the user picked a different view inside the panel; the page is
 *   untouched.
 */
export type BrowserChangeReason = 'page' | 'view';

/**
 * @typeParam TView - Whatever the extension uses to name the views inside its side
 * panel, usually a union of string literals.
 */
export interface BrowserChangeEvent<TView> {
  reason: BrowserChangeReason;
  /** The active tab the side panel is looking at. */
  tabId: number;
  /** Never empty — a tab with no URL is not announced. */
  url: string;
  windowId: number;
  tab: chrome.tabs.Tab;
  /** The view on screen, so a handler can ignore changes that are not its own. */
  view: TView;
  /**
   * The tab this event moved away from, or `null` for the first event after the
   * panel opens. Handlers that left something behind on a page — markers, injected
   * UI — need it to clean up the tab they are leaving, not the one being arrived
   * at.
   */
  previousTabId: number | null;
  /**
   * True when this is the first event for a side panel document that has just
   * loaded. The panel has rendered nothing yet, so a handler that skips work for a
   * page it believes is already on screen has to treat this as a fresh page — what
   * it drew last time went away with the previous document.
   */
  isPanelReload: boolean;
}

export type BrowserChangeHandler<TView> = (
  event: BrowserChangeEvent<TView>,
) => Promise<void> | void;

export interface BrowserChangeWatcherOptions<TView> {
  /**
   * The view a freshly loaded panel document starts on. A new document has none of
   * the previous one's state, so the watcher resets to this rather than waiting for
   * the panel's first report.
   */
  defaultView: TView;
  /**
   * How long to wait for a navigation to settle before announcing it.
   * `chrome.tabs.onUpdated` fires repeatedly through a single navigation.
   *
   * @default 500
   */
  debounceMs?: number;
}

export interface BrowserChangeWatcher<TView> {
  /**
   * Registers `handler` for every page or view change under the side panel.
   * Returns a disposer.
   */
  onBrowserChange: (handler: BrowserChangeHandler<TView>) => () => void;
  /**
   * Tells the watcher which view the panel is showing. Call it from wherever the
   * panel reports its view; repeats of the view already recorded are ignored, so it
   * is safe to call on mount as well as on a change.
   */
  setView: (view: TView) => void;
  /** Removes the watcher's browser listeners and drops every handler. */
  dispose: () => void;
}

/** The page a window's side panel currently has on screen. */
export interface DisplayedPage {
  tabId: number;
  url: string;
}

/** The part of a {@link BrowserChangeEvent} a {@link DisplayedPageTracker} reads. */
export interface DisplayedPageInput {
  windowId: number;
  tabId: number;
  url: string;
  isPanelReload: boolean;
}

export interface DisplayedPageTracker {
  /**
   * True when the panel in this window already has this exact page on screen, so
   * there is nothing for the user to wait for.
   */
  isDisplaying: (event: DisplayedPageInput) => boolean;
  /** Records the page the panel is now showing. */
  record: (event: DisplayedPageInput) => void;
  /** Drops what is remembered for a window, e.g. when the window closes. */
  forget: (windowId: number) => void;
}
