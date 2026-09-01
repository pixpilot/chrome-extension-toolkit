# Side panel refresh — fixed bugs and live edges

A record of the "keep the side panel in step with the page" work done on 2026-09-01,
written so it can be handed to someone (or to Claude) when a related symptom turns
up again. It covers what broke, why, what the fix was, and which edges are still
open.

Symptoms this file is relevant to: the panel flashes a loader on its own; a spinner
appears when nothing moved; an empty state shows over content that exists; the panel
refuses to refresh; something fires "periodically" with no timer in the code.

## The mechanism in one pass

```
side panel document                 service worker
───────────────────                 ──────────────
initializeSidePanelStateTracker
  └─ chrome.runtime.connect ──────► initSidePanelStateManager
     reason: document-load             └─ lastKnownStates: Map<windowId, state>
             visibility-change            onSidePanelStateChange  (raw feed)
             reconnected                  onSidePanelShown/Hidden (transitions)
     port drop ─────────────────►      reason: port-disconnected      │
                                                                      ▼
                                        createBrowserChangeWatcher
                                          chrome.tabs.onUpdated
                                          chrome.tabs.onActivated
                                          debounce · (tabId,url) dedupe
                                                      │
                                                      ▼
                                          onBrowserChange handlers
```

Who owns what:

- **watcher** — browser listeners, the debounce, the "have we already said this"
  dedupe, and the `isPanelReload` flag. Knows nothing about any feature.
- **handlers** — what to render. Use `createDisplayedPageTracker` to decide whether a
  loading state is warranted.
- **`reason`** on a state change is load-bearing: `document-load` (new panel
  document), `visibility-change` (same document hidden/shown), `reconnected` (the
  worker restarted, the document is untouched), `port-disconnected` (panel gone).

## Fixed

### 1. A service worker restart looked like the panel reappearing

**Symptom** — the panel flashed a loader every few minutes with nothing happening on
screen. Nothing in the code had a timer, which is what made it hard to find.

**Cause** — Chrome recycles the worker; the tracker reconnects and reports
`state: 'visible', reason: 'reconnected'`. The restarted worker's `lastKnownStates`
is empty, so `previousState` is `undefined`, which is not a repeat, so
`onSidePanelShown` fired and consumers re-ran a full refresh. The repeat filter added
in 0.10.0 only works inside one worker lifetime — it cannot survive the thing that
wipes it.

**Fix** — `onSidePanelShown` and `onSidePanelHidden` ignore `reason: 'reconnected'`
outright. A reconnect is a transport event, not a visibility transition.
`onSidePanelStateChange` still reports it for anyone who wants the raw feed.
Shipped in 0.10.1. See `sidepanel-state-manager.ts`.

### 2. Background tabs cancelled real navigations

**Symptom** — a navigation sometimes never reached the handlers.

**Cause** — one debounce shared by every tab, and the `tab.active` check happened
_after_ it. A background tab firing `onUpdated` inside the 500 ms window replaced the
pending dispatch, then bailed on the active check. The real event was gone.

**Fix** — `onTabChange` drops non-active tabs before touching the debounce.

### 3. A loader flashed over a page already on screen

**Symptom** — spinner over content that was already correct.

**Cause** — the handler sent `loader: show` unconditionally on every `page` event, and
`page` events legitimately repeat (panel returns to view, worker recycles, view
re-entered).

**Fix** — track what the panel is displaying and skip the loading state when it
already matches. `createDisplayedPageTracker`.

### 4. A fresh panel document got no loader

**Symptom** — close and reopen the panel on the same page (within ~30 s, before the
worker is recycled) and no spinner appears. Instead the panel's _empty state_ renders
over a page that has saved data, until the fetch lands.

**Cause** — the guard from #3 remembered "this page was rendered", but the panel
document that rendered it was gone. The handler had no way to tell a fresh document
apart from any other page event.

Worth knowing how bad this is: in roleclick the fetch behind it is a tRPC network
call, measured at 104–131 ms on a good connection. The panel showed
`JobInsightsPlaceholder` — "no insights" — over a job that was saved. A flash of
_wrong content_, not a blank.

**Fix** — `BrowserChangeEvent.isPanelReload`, set for the first event after
`onSidePanelShown` fires with `reason: 'document-load'`. `isDisplaying` returns
`false` whenever it is set.

### 5. The displayed-page guard was keyed by tab

**Symptom** — same as #4, different trigger: switch to another tab and back, and the
panel showed its empty state over saved content.

**Cause** — the first version of the guard was `Map<tabId, url>`, "what each tab last
rendered". But the panel is one document showing one page at a time. Once it moved to
tab B it was displaying B, so returning to A was a real change even though A had been
rendered before.

**Fix** — `Map<windowId, { tabId, url }>` — "what this window's panel currently has on
screen". Both fields must match.

This one was caught only because the instrumentation was still in place during
verification. It is the single most likely shape for this bug to come back in.

## Still open

Nothing below is broken today; they are the known thin spots.

1. **One debounce per watcher, not per window.** Fine for a single panel. With two
   windows navigating at once, one window's navigation resets the other's timer.
2. **`chrome.tabs.onUpdated` is unfiltered.** Every update on the active tab enters
   the debounce — title, favicon, status. The `(tabId, url)` dedupe absorbs them, but
   each one _reschedules_ the timer, so a page that fires `onUpdated` continuously
   (some SPAs, ad-heavy pages) can postpone a dispatch indefinitely. Filtering on
   `changeInfo.url ?? changeInfo.status` would fix it; not done because no page has
   actually triggered it yet.
3. **`setView` attributes the change to the last focused window.** The panel reporting
   its view carries no window id, so `announceViewChange` queries
   `{ active: true, lastFocusedWindow: true }`. Two windows with panels open, and a
   view change in the unfocused one lands on the wrong window.
4. **No event says "what is open" after a worker restart.** `onSidePanelShown`
   deliberately stays quiet on reconnect (#1), so nothing fires. Code that needs to
   bootstrap on wake must _ask_: `isWindowSidePanelVisible(windowId)`. If this becomes
   a common need it wants its own listener, not un-filtering `onSidePanelShown`.
5. **`DisplayedPageTracker.forget` is never called.** One small entry per window, and
   the worker's own recycling clears it, so no listener is wired to
   `chrome.windows.onRemoved` — that would wake the worker on every window close for
   no benefit. Call `forget` yourself if a consumer ever needs it.
6. **`visibilitychange` still re-runs every handler.** Moving focus to another Chrome
   window and back hides then shows the panel document, which re-runs the active tab
   through the whole flow. Silent since #3 and #4, but the data fetches do happen.
7. **The suppression path is only unit-tested.** `isDisplaying` returning `true` was
   never observed in live testing — every manual run took a path where it was `false`.
   Covered in `test/displayed-page-tracker.test.ts`. Worst case if it regresses is a
   spinner that need not appear, not wrong content.
8. **`isPanelReload` depends on `document-load` arriving.** It is set only from
   `onSidePanelShown`. A panel document that somehow loads without the tracker
   reporting `document-load` would not be marked, and #4 comes back.

## Debugging notes

Things that cost time and will cost it again:

- **Opening the service worker's DevTools keeps the worker alive.** That is useful —
  it is how you keep in-memory state alive long enough to reproduce #4/#5 — but it
  also means you cannot observe a recycle while watching the console. If a bug only
  appears "sometimes", worker lifetime is the first suspect.
- **Reaching a breakpoint proves nothing** about these bugs. The handler runs in both
  the good and bad case; what differs is whether a _message_ is sent. Log the
  decision, do not watch the control flow.
- **`grep -c` on a dist bundle lies.** The build is one minified line, so `-c` returns
  1 no matter what. Use `grep -o 'needle' dist/index.js | wc -l`.
- **`pnpm install` will not pick up a new publish** when the lockfile pins the old
  version and the range still matches. Use `pnpm up <pkg>@latest`, then confirm the
  resolved version in `node_modules/.pnpm/`.
- **Instrumentation that worked** — log the decision inputs at the top of the handler
  and the elapsed time of whatever the loading state is covering:

  ```ts
  console.log('[feature]', {
    reason,
    view,
    tabId,
    url,
    isPanelReload,
    isDisplaying: displayedPage.isDisplaying(event),
  });
  ```

  Then: open the panel, close it, reopen fast, switch tabs, switch back. Those four
  moves exercise every path above.

## Versions

| version | what landed                                                                  |
| ------- | ---------------------------------------------------------------------------- |
| 0.10.0  | `previousState` + repeat filtering, `onSidePanelShown` / `onSidePanelHidden` |
| 0.10.1  | reconnects no longer fire the transition helpers (#1)                        |
| 0.11.0  | `createBrowserChangeWatcher`, `createDisplayedPageTracker`, `isPanelReload`  |

roleclick consumed this as `^0.11.0`; its `browser-change/` folder went from 259 lines
to 26 (names its views, wires `sidePanelTabChange` to `setView`) and
`sync-job-insights.ts` uses the tracker.
