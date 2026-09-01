import { describe, expect, it } from 'vitest';
import { createDisplayedPageTracker } from '../src/displayed-page-tracker';

function page(
  overrides: Partial<
    Parameters<ReturnType<typeof createDisplayedPageTracker>['isDisplaying']>[0]
  > = {},
) {
  return {
    windowId: 1,
    tabId: 10,
    url: 'https://example.com/a',
    isPanelReload: false,
    ...overrides,
  };
}

describe('createDisplayedPageTracker', () => {
  it('should not report a page it has never seen', () => {
    const tracker = createDisplayedPageTracker();

    expect(tracker.isDisplaying(page())).toBe(false);
  });

  it('should report a page it recorded', () => {
    const tracker = createDisplayedPageTracker();

    tracker.record(page());

    expect(tracker.isDisplaying(page())).toBe(true);
  });

  it('should not report a different url in the same tab', () => {
    const tracker = createDisplayedPageTracker();

    tracker.record(page());

    expect(tracker.isDisplaying(page({ url: 'https://example.com/b' }))).toBe(false);
  });

  it('should not report a tab the panel moved away from', () => {
    const tracker = createDisplayedPageTracker();

    // The panel showed tab 10, then moved to tab 11. It is now displaying tab 11, so
    // coming back to 10 is a real change even though 10 was rendered before.
    tracker.record(page());
    tracker.record(page({ tabId: 11, url: 'https://example.com/b' }));

    expect(tracker.isDisplaying(page())).toBe(false);
  });

  it('should keep windows apart', () => {
    const tracker = createDisplayedPageTracker();

    tracker.record(page());

    expect(tracker.isDisplaying(page({ windowId: 2 }))).toBe(false);
    expect(tracker.isDisplaying(page())).toBe(true);
  });

  it('should never report a page for a panel document that just loaded', () => {
    const tracker = createDisplayedPageTracker();

    // A fresh document has drawn nothing, whatever was recorded for the window.
    tracker.record(page());

    expect(tracker.isDisplaying(page({ isPanelReload: true }))).toBe(false);
  });

  it('should forget a window', () => {
    const tracker = createDisplayedPageTracker();

    tracker.record(page());
    tracker.forget(1);

    expect(tracker.isDisplaying(page())).toBe(false);
  });
});
