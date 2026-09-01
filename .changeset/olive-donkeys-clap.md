---
'@pixpilot/chrome-lifecycle': minor
---

Add `createBrowserChangeWatcher` and `createDisplayedPageTracker`.

Every extension with a side panel ends up writing the same watcher: listen to
`chrome.tabs`, debounce a navigation that fires a dozen times, drop updates from
tabs the user is not on, re-run the active tab when the panel comes back, and hand
features one event instead of making each wire its own listeners. It is easy to get
subtly wrong, and the failures look like a panel that flashes or refuses to refresh.

```typescript
const { onBrowserChange, setView } = createBrowserChangeWatcher({
  defaultView: 'insights',
});

sidePanelTabChange.onMessage(setView);

onBrowserChange(async ({ reason, view, tabId, url, windowId, isPanelReload }) => {
  // ...
});
```

The watcher knows nothing about how a panel reports its view — call `setView` from
wherever that arrives, and repeats of the view already recorded are ignored.

`isPanelReload` marks the first event for a panel document that has just loaded. A
fresh document has drawn nothing, so a handler that skips work for a page it thinks
is already on screen has to treat it as new.

`createDisplayedPageTracker` answers that question, keyed by window rather than by
tab: a panel shows one page at a time, so once it has moved to another tab, coming
back is a real change even though that tab was rendered before. Getting this wrong
leaves an empty state on screen while fresh data loads.

```typescript
const displayedPage = createDisplayedPageTracker();

onBrowserChange(async (event) => {
  const isAlreadyOnScreen = displayedPage.isDisplaying(event);
  displayedPage.record(event);

  if (!isAlreadyOnScreen) {
    await showLoader(event.windowId);
  }
});
```
