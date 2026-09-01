import type { DisplayedPage, DisplayedPageInput, DisplayedPageTracker } from './types';

/**
 * Remembers what each window's side panel currently has on screen, so a handler can
 * tell a real move apart from a page being announced again.
 *
 * The same page reaches a handler more than once — the panel comes back into view,
 * the service worker is recycled, a feature re-reads its data — and putting a
 * loading state up for a page already rendered replaces good content with a spinner,
 * or worse, with an empty state.
 *
 * Keyed by window, not by tab, because a panel shows one page at a time: once it has
 * moved to another tab, coming back is a real change even though that tab had been
 * rendered before. A panel document that has just loaded has drawn nothing, so
 * {@link DisplayedPageTracker.isDisplaying} is always false for it.
 *
 * @example
 * ```typescript
 * const displayedPage = createDisplayedPageTracker();
 *
 * onBrowserChange(async (event) => {
 *   const isAlreadyOnScreen = displayedPage.isDisplaying(event);
 *   displayedPage.record(event);
 *
 *   if (!isAlreadyOnScreen) {
 *     await showLoader(event.windowId);
 *   }
 *
 *   await render(await loadData(event.tabId), event.windowId);
 * });
 * ```
 */
export function createDisplayedPageTracker(): DisplayedPageTracker {
  const displayedByWindow = new Map<number, DisplayedPage>();

  return {
    isDisplaying(event: DisplayedPageInput): boolean {
      if (event.isPanelReload) {
        return false;
      }

      const displayed = displayedByWindow.get(event.windowId);

      return displayed?.tabId === event.tabId && displayed.url === event.url;
    },

    record(event: DisplayedPageInput): void {
      displayedByWindow.set(event.windowId, { tabId: event.tabId, url: event.url });
    },

    forget(windowId: number): void {
      displayedByWindow.delete(windowId);
    },
  };
}
