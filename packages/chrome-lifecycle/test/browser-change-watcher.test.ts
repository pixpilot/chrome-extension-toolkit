import type { SidePanelStateChangeData } from '../src/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserChangeWatcher } from '../src/browser-change-watcher';

const mocks = vi.hoisted(() => {
  const shownListeners = new Set<(data: SidePanelStateChangeData) => void>();

  return {
    shownListeners,
    isWindowSidePanelVisible: vi.fn<(windowId: number) => boolean>(() => true),
    onSidePanelShown: vi.fn((listener: (data: SidePanelStateChangeData) => void) => {
      shownListeners.add(listener);
      return () => {
        shownListeners.delete(listener);
      };
    }),
  };
});

vi.mock('../src/sidepanel-state-manager', () => ({
  isWindowSidePanelVisible: mocks.isWindowSidePanelVisible,
  onSidePanelShown: mocks.onSidePanelShown,
}));

type View = 'insights' | 'resume';

const WINDOW_ID = 1;

const tabs = new Map<number, chrome.tabs.Tab>();

function setTab(tabId: number, url: string, active = true, windowId = WINDOW_ID) {
  tabs.set(tabId, { id: tabId, url, active, windowId } as chrome.tabs.Tab);
}

const mockChrome = {
  tabs: {
    get: vi.fn(async (tabId: number) => {
      const tab = tabs.get(tabId);

      if (!tab) {
        throw new Error(`No tab with id ${tabId}`);
      }

      return tab;
    }),
    query: vi.fn(async (info: chrome.tabs.QueryInfo) =>
      [...tabs.values()].filter(
        (tab) =>
          tab.active === true &&
          (info.windowId == null || tab.windowId === info.windowId),
      ),
    ),
    onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
  },
};

/** Runs the promise chains the watcher kicks off from its listeners. */
async function settle() {
  for (let i = 0; i < 5; i += 1) {
    // Sequential on purpose: each pass lets the next link of the promise chain run.
    // eslint-disable-next-line no-await-in-loop
    await vi.advanceTimersByTimeAsync(0);
  }
}

/** Runs them, then lets the debounce fire. */
async function settleDebounced() {
  await settle();
  await vi.advanceTimersByTimeAsync(500);
  await settle();
}

function emitTabUpdated(tabId: number) {
  const listener = mockChrome.tabs.onUpdated.addListener.mock.calls[0]![0] as (
    tabId: number,
  ) => void;
  listener(tabId);
}

function emitTabActivated(tabId: number) {
  const listener = mockChrome.tabs.onActivated.addListener.mock.calls[0]![0] as (info: {
    tabId: number;
  }) => void;
  listener({ tabId });
}

function emitPanelShown(reason: string) {
  mocks.shownListeners.forEach((listener) => {
    listener({ state: 'visible', reason, windowId: WINDOW_ID });
  });
}

function setup() {
  const watcher = createBrowserChangeWatcher<View>({ defaultView: 'insights' });
  const handler = vi.fn();
  watcher.onBrowserChange(handler);

  return { watcher, handler };
}

describe('createBrowserChangeWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    tabs.clear();
    mocks.shownListeners.clear();
    mocks.isWindowSidePanelVisible.mockReturnValue(true);
    // @ts-expect-error - Mocking global chrome object
    globalThis.chrome = mockChrome;
    setTab(10, 'https://example.com/a');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('page changes', () => {
    it('should announce a navigation in the active tab', async () => {
      const { handler } = setup();

      emitTabUpdated(10);
      await settleDebounced();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'page',
          tabId: 10,
          url: 'https://example.com/a',
          windowId: WINDOW_ID,
          view: 'insights',
          previousTabId: null,
          isPanelReload: false,
        }),
      );
    });

    it('should announce a page only once while the tab keeps reporting it', async () => {
      const { handler } = setup();

      emitTabUpdated(10);
      await settleDebounced();
      emitTabUpdated(10);
      await settleDebounced();

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should announce the same url again in a different tab', async () => {
      const { handler } = setup();

      emitTabUpdated(10);
      await settleDebounced();

      setTab(10, 'https://example.com/a', false);
      setTab(11, 'https://example.com/a');
      emitTabActivated(11);
      await settleDebounced();

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenLastCalledWith(
        expect.objectContaining({ tabId: 11, previousTabId: 10 }),
      );
    });

    it('should ignore a tab that is not the one the user is on', async () => {
      const { handler } = setup();

      setTab(11, 'https://background.example', false);
      emitTabUpdated(11);
      await settleDebounced();

      expect(handler).not.toHaveBeenCalled();
    });

    it('should not let a background tab cancel a pending navigation', async () => {
      const { handler } = setup();

      emitTabUpdated(10);
      await settle();

      // Arrives inside the debounce window. The active tab's navigation must still
      // be announced when the debounce fires.
      setTab(11, 'https://background.example', false);
      emitTabUpdated(11);
      await settleDebounced();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ tabId: 10 }));
    });

    it('should stay quiet while the side panel is not visible', async () => {
      mocks.isWindowSidePanelVisible.mockReturnValue(false);
      const { handler } = setup();

      emitTabUpdated(10);
      await settleDebounced();

      expect(handler).not.toHaveBeenCalled();
    });

    it('should ignore a tab with no url', async () => {
      const { handler } = setup();

      tabs.set(11, { id: 11, active: true, windowId: WINDOW_ID } as chrome.tabs.Tab);
      emitTabUpdated(11);
      await settleDebounced();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('view changes', () => {
    it('should announce a view change against the active tab', async () => {
      const { watcher, handler } = setup();

      watcher.setView('resume');
      await settle();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'view', view: 'resume', tabId: 10 }),
      );
    });

    it('should ignore a repeat of the view already recorded', async () => {
      const { watcher, handler } = setup();

      watcher.setView('insights');
      await settle();

      expect(handler).not.toHaveBeenCalled();
    });

    it('should not let a view change claim the page', async () => {
      const { watcher, handler } = setup();

      // A view change says nothing about the page, so the navigation that follows is
      // still new.
      watcher.setView('resume');
      await settle();
      emitTabUpdated(10);
      await settleDebounced();

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenLastCalledWith(
        expect.objectContaining({ reason: 'page', view: 'resume' }),
      );
    });
  });

  describe('panel shown', () => {
    it('should re-run the active tab when the panel comes back', async () => {
      const { handler } = setup();

      emitPanelShown('visibility-change');
      await settle();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'page', tabId: 10, isPanelReload: false }),
      );
    });

    it('should flag a freshly loaded panel document', async () => {
      const { handler } = setup();

      emitPanelShown('document-load');
      await settle();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ isPanelReload: true }),
      );
    });

    it('should reset the view for a freshly loaded panel document', async () => {
      const { watcher, handler } = setup();

      watcher.setView('resume');
      await settle();
      handler.mockClear();

      emitPanelShown('document-load');
      await settle();

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ view: 'insights' }));
    });

    it('should keep the view a cached panel document still has', async () => {
      const { watcher, handler } = setup();

      watcher.setView('resume');
      await settle();
      handler.mockClear();

      emitPanelShown('visibility-change');
      await settle();

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ view: 'resume' }));
    });

    it('should announce the page again even though nothing moved', async () => {
      const { handler } = setup();

      emitTabUpdated(10);
      await settleDebounced();
      emitPanelShown('visibility-change');
      await settle();

      // The panel was away and may be showing anything, so the dedupe is dropped.
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('handlers', () => {
    it('should keep running handlers after one throws', async () => {
      const { watcher } = setup();
      const failing = vi.fn(() => {
        throw new Error('boom');
      });
      const other = vi.fn();
      watcher.onBrowserChange(failing);
      watcher.onBrowserChange(other);
      vi.spyOn(console, 'error').mockImplementation(() => {});

      emitTabUpdated(10);
      await settleDebounced();

      expect(failing).toHaveBeenCalledTimes(1);
      expect(other).toHaveBeenCalledTimes(1);
    });

    it('should stop calling a handler that unsubscribed', async () => {
      const { watcher } = setup();
      const handler = vi.fn();
      const unsubscribe = watcher.onBrowserChange(handler);

      unsubscribe();
      emitTabUpdated(10);
      await settleDebounced();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should remove its browser listeners and drop handlers', async () => {
      const { watcher, handler } = setup();

      watcher.dispose();

      expect(mockChrome.tabs.onUpdated.removeListener).toHaveBeenCalledTimes(1);
      expect(mockChrome.tabs.onActivated.removeListener).toHaveBeenCalledTimes(1);
      expect(mocks.shownListeners.size).toBe(0);

      emitTabUpdated(10);
      await settleDebounced();

      expect(handler).not.toHaveBeenCalled();
    });

    it('should cancel a navigation still inside the debounce', async () => {
      const { watcher, handler } = setup();

      emitTabUpdated(10);
      await settle();
      watcher.dispose();
      await settleDebounced();

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
