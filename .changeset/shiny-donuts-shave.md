---
'@pixpilot/chrome-lifecycle': minor
---

Add `onSidePanelShown` and `onSidePanelHidden` for side panel visibility transitions.

`onSidePanelStateChange` fires for every state report, including repeats of a state
the listener already knew about — a reconnect while still visible, or a visibility
change followed by a port disconnect. Every consumer that wanted "the panel just
came back, resync it" had to keep its own `Map<windowId, state>` to dedupe.

State change data now carries `previousState`, and the two new helpers filter on it:

```typescript
onSidePanelShown(({ windowId }) => refreshPanelContents(windowId));
```

This matters when another extension's side panel takes over the slot. Chrome keeps
the hidden document alive rather than tearing it down, so returning to your panel
reports `visibility-change`, not `document-load` — a listener keyed on
`document-load` serves stale content instead of refreshing.
