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

**Background script (service worker):**

```typescript
import { initSidePanelStateManager } from '@pixpilot/chrome-lifecycle';

// Initialize once at startup
initSidePanelStateManager();
```

**Side panel script (frontend):**

```typescript
import { initializeSidePanelStateTracker } from '@pixpilot/chrome-lifecycle';

// Initialize when side panel loads
const cleanup = initializeSidePanelStateTracker();
```

#### Functions

##### `initSidePanelStateManager()`

Initializes the backend state manager. Must be called once in your background script before using other side panel functions. Subsequent calls log a warning and are ignored.

```typescript
import { initSidePanelStateManager } from '@pixpilot/chrome-lifecycle';

initSidePanelStateManager();
```

##### `initializeSidePanelStateTracker()`

Initializes the frontend tracker in your side panel. Sets up visibility tracking and heartbeat to keep the connection alive.

```typescript
import { initializeSidePanelStateTracker } from '@pixpilot/chrome-lifecycle';

const cleanup = initializeSidePanelStateTracker();
```

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
