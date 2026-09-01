---
'@pixpilot/chrome-lifecycle': patch
---

Stop `onSidePanelShown` and `onSidePanelHidden` firing on tracker reconnects.

A reconnect (`reason: 'reconnected'`) is the tracker re-attaching after Chrome tore
the service worker down and started it again. The panel document lives through that
untouched, so nothing appeared or disappeared — but the restarted worker has no
record of the window, leaving `previousState` empty, so every recycle looked like a
fresh show. Consumers using `onSidePanelShown` to resync the panel were re-running
that work on a timer they did not set, flashing loaders over content that was
already correct.

Both helpers now ignore reconnects. `onSidePanelStateChange` is unchanged and still
reports them, so code that wants the raw tracker feed keeps it.
