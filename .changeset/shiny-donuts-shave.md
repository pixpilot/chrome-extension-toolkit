---
'@pixpilot/chrome-lifecycle': minor
---

Make `onSidePanelStateChange` report state *changes*, and add `onSidePanelShown` /
`onSidePanelHidden`.

**Behavior change:** `onSidePanelStateChange` previously fired for every state report
the tracker sent, including repeats of a state the listener already knew about — a
reconnect while still visible, or a `port-disconnected` after the panel had already
reported itself hidden. It now fires only when a window's state actually changes.
Pass `{ includeRepeats: true }` to get the old raw feed; the option is per listener.

State change data carries a new `previousState` field, and two narrowed listeners
are available for code that only cares about one direction:

```typescript
onSidePanelShown(({ windowId }) => refreshPanelContents(windowId));
```

This matters when another extension's side panel takes over the slot. Chrome keeps
the hidden document alive rather than tearing it down, so returning to your panel
reports `visibility-change`, not `document-load` — a listener keyed on
`document-load` serves stale content instead of refreshing.
