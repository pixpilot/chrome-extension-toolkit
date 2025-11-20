# @pixpilot/chrome-lifecycle

A utility package for managing Chrome extension lifecycle events.

## onWindowClose

Registers a callback to be executed when a specific Chrome window is closed. This is useful for triggering alerts, saving data, or cleaning up resources when a specific popup or window is removed.

### Usage

```typescript
import { onWindowClose } from '@pixpilot/chrome-lifecycle';

const unsubscribe = onWindowClose(windowId, () => {
  console.log('Window was closed!');
  // Perform cleanup or other actions
});

// Later, to stop listening:
unsubscribe();
```

### Parameters

- `windowId` (number): The Chrome window ID to watch
- `callback` (function): Function to execute when the window closes

### Returns

A function to unsubscribe (remove) the listener.
