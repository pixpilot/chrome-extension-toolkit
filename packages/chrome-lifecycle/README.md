# @pixpilot/chrome-lifecycle

Utilities for managing Chrome extension lifecycle events.

## Installation

```bash
npm install @pixpilot/chrome-lifecycle
```

## API

### Window Events

#### `onWindowClose(windowId, callback)`

Registers a callback when a specific Chrome window closes.

```typescript
import { onWindowClose } from '@pixpilot/chrome-lifecycle';

const unsubscribe = onWindowClose(windowId, () => {
  console.log('Window closed');
});

// Stop listening
unsubscribe();
```

| Parameter  | Type         | Description                  |
| ---------- | ------------ | ---------------------------- |
| `windowId` | `number`     | Chrome window ID to watch    |
| `callback` | `() => void` | Function to execute on close |

**Returns:** Unsubscribe function

---

### Side Panel State Manager

Tracks whether side panels are visible or hidden across different windows.

#### Setup

This feature requires initialization in both your background script and side panel script.

**1. Background script (service worker):**

Call `initSidePanelStateManager()` at the top of your background script, before any other side panel functions. All other functions (`getSidePanelStateForWindow`, `isWindowSidePanelVisible`, `onSidePanelStateChange`) will throw an error if called before initialization.

```typescript
// background.ts
import { initSidePanelStateManager } from '@pixpilot/chrome-lifecycle';

// ⚠️ Critical Setup
// Must be called first, before any other side panel functions
initSidePanelStateManager();

// Now you can use other functions
```

**2. Side panel script (frontend):**

Call `initializeSidePanelStateTracker()` when your side panel loads. This announces the panel state, tracks document visibility changes by default, and reconnects automatically if the Manifest V3 service worker restarts.

```typescript
// sidepanel.ts
import { initializeSidePanelStateTracker } from '@pixpilot/chrome-lifecycle';

const cleanup = initializeSidePanelStateTracker();

// Optional: call cleanup() when done to remove listeners and disconnect
```

#### Functions

##### `initSidePanelStateManager()`

Initializes the backend state manager. **Must be called once at the top of your background script before using any other side panel functions.** Subsequent calls log a warning and are ignored.

##### `initializeSidePanelStateTracker()`

Initializes the frontend tracker in your side panel. It reconnects automatically when the background service worker disconnects and, by default, reports `document.hidden` as hidden side panel state.

**Returns:** Cleanup function to remove listeners and disconnect

Options:

| Property                  | Type      | Default | Description                                                                      |
| ------------------------- | --------- | ------- | -------------------------------------------------------------------------------- |
| `trackDocumentVisibility` | `boolean` | `true`  | When true, `document.hidden` is reported as hidden state via `visibilitychange`. |

##### `isWindowSidePanelVisible(windowId)`

Returns `true` if the side panel is visible for the given window.

```typescript
import { isWindowSidePanelVisible } from '@pixpilot/chrome-lifecycle';

const isVisible = isWindowSidePanelVisible(windowId);
```

##### `getSidePanelStateForWindow(windowId)`

Returns the current state (`'visible'` | `'hidden'` | `undefined`) for the given window.

```typescript
import { getSidePanelStateForWindow } from '@pixpilot/chrome-lifecycle';

const state = getSidePanelStateForWindow(windowId);
```

##### `onSidePanelStateChange(listener, options?)`

Listens for side panel state changes across all windows.

```typescript
import { onSidePanelStateChange } from '@pixpilot/chrome-lifecycle';

const unsubscribe = onSidePanelStateChange(({ windowId, state, reason }) => {
  console.log(`Window ${windowId}: ${state}`);
});

// Stop listening
unsubscribe();
```

**Callback data:**

| Property        | Type                                     | Description                                     |
| --------------- | ---------------------------------------- | ----------------------------------------------- |
| `windowId`      | `number`                                 | Chrome window ID                                |
| `state`         | `'visible'` \| `'hidden'`                | Current side panel state                        |
| `previousState` | `'visible'` \| `'hidden'` \| `undefined` | State known before this one, `undefined` if new |
| `reason`        | `string`                                 | What triggered the change                       |

**Options:**

| Property         | Type      | Default | Description                                              |
| ---------------- | --------- | ------- | -------------------------------------------------------- |
| `includeRepeats` | `boolean` | `false` | Also deliver reports that repeat the state already known |

**Returns:** Unsubscribe function

This fires when a window's state actually **changes**. The tracker reports the same
state more than once — it re-reports `visible` when it reconnects to a restarted
service worker, and a panel can report `hidden` twice in a row (a visibility change,
then a port disconnect) — and those repeats are filtered out, so listeners don't
have to track the previous state themselves.

Pass `{ includeRepeats: true }` to observe the raw tracker feed instead. The option
is per listener, so one listener can watch changes while another watches everything:

```typescript
onSidePanelStateChange(({ windowId, state }) => syncPanel(windowId, state));

onSidePanelStateChange(
  ({ reason }) => {
    // 'visibility-change' hidden means the panel was hidden;
    // 'port-disconnected' hidden means its document went away.
    if (reason === 'port-disconnected') dropDocumentCache();
  },
  { includeRepeats: true },
);
```

##### `onSidePanelShown(listener)`

`onSidePanelStateChange` narrowed to one direction, for code that only cares when a
side panel _becomes_ visible. This is the event to use for "the panel is back on
screen, resync it".

```typescript
import { onSidePanelShown } from '@pixpilot/chrome-lifecycle';

const unsubscribe = onSidePanelShown(({ windowId, reason }) => {
  refreshPanelContents(windowId);
});
```

It covers three cases, distinguishable via `reason`:

| `reason`            | When                                                                               |
| ------------------- | ---------------------------------------------------------------------------------- |
| `document-load`     | A freshly loaded panel document                                                    |
| `visibility-change` | A cached document Chrome is showing again — see the note on other extensions below |
| `reconnected`       | First report after the service worker restarted, so your background state was lost |

**Callback data:** same as `onSidePanelStateChange`

**Returns:** Unsubscribe function

##### `onSidePanelHidden(listener)`

The same narrowing for the other direction: fires only when a side panel stops being
visible. Nothing fires for a window that was never seen visible, so a service worker
restart followed by a port disconnect stays quiet instead of reporting a close the
listener never saw open.

**Callback data:** same as `onSidePanelStateChange`

**Returns:** Unsubscribe function

#### When another extension's side panel takes over

Chrome gives all extensions one side panel slot per window. When the user opens a
different extension's panel, yours does **not** get torn down — Chrome keeps the
document alive and hides it, so it comes back with all of its state intact,
including anything stale it was showing before the switch.

That surfaces here as `visibility-change`, never `document-load`. A listener that
only refreshes on `document-load` will look correct until a user has two side panel
extensions installed, and then silently serve stale content. `onSidePanelShown` — or
`onSidePanelStateChange` checking for `state === 'visible'` — covers both.

There is no Chrome API to ask whether your panel is the one currently on screen, so
`document.hidden` in the panel document is the only available signal. Leave
`trackDocumentVisibility` enabled if you rely on this.

## Notes

[Side panel refresh — fixed bugs and live edges](docs/side-panel-refresh.md) — why the
transition helpers ignore reconnects, what `isPanelReload` is for, and the edge cases
around keeping a panel in step with the active tab.
