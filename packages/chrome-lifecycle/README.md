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

Call `initializeSidePanelStateTracker()` when your side panel loads. This sets up visibility tracking and a heartbeat to keep the connection alive.

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

Initializes the frontend tracker in your side panel. Sets up visibility change detection and a heartbeat (every 15 seconds) to maintain the connection.

**Returns:** Cleanup function to remove listeners and disconnect

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

##### `onSidePanelStateChange(listener)`

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

| Property   | Type                      | Description               |
| ---------- | ------------------------- | ------------------------- |
| `windowId` | `number`                  | Chrome window ID          |
| `state`    | `'visible'` \| `'hidden'` | Current side panel state  |
| `reason`   | `string`                  | What triggered the change |

**Returns:** Unsubscribe function
