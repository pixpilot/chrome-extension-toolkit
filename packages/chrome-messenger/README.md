# Chrome Messenger

A simple, type-safe messaging library for Chrome extensions with React hooks support.

## Installation

```bash
npm install chrome-messenger
```

## Basic Usage

### Regular Messages

```typescript
import { createMessage } from 'chrome-messenger';

// Create message sender and listener
const { send: sendNotification, onMessage: onNotification } = createMessage<{
  message: string;
}>('notification');

// Send message (always returns a Promise)
await sendNotification({ message: 'Hello!' });

// Listen for messages
const dispose = onNotification((data, sender) => {
  console.log('Received:', data.message);
});

// Clean up when done
dispose();
```

### With Response

```typescript
import { createMessage } from 'chrome-messenger';

const { send: fetchUser, onMessage: onFetchUser } = createMessage<{ id: string }, User>(
  'fetch-user',
);

// Sender returns a Promise with the response
const user = await fetchUser({ id: '123' });

// Handler must return the response
onFetchUser(async ({ id }) => await getUserById(id));
```

## Error Handling

Errors thrown in message handlers are automatically converted to thrown errors on the sender side:

```typescript
const { send: signIn, onMessage: onSignIn } = createMessage<
  { email: string; password: string },
  { userId: string }
>('user-signin');

// Handler can throw errors normally
onSignIn(async ({ email, password }) => {
  const result = await authenticateUser(email, password);
  if (!result.success) {
    throw new Error('Invalid credentials'); // This gets thrown to sender
  }
  return { userId: result.user.id };
});

// Sender catches errors with standard try-catch
try {
  const user = await signIn({ email, password });
  console.log('Signed in:', user);
} catch (error) {
  console.error('Sign in failed:', error.message); // Works!
}
```

## React Integration

### Message Hooks

```tsx
import { createMessageState } from 'chrome-messenger/react';

// Returns { send, useMessage } object
export const { send: fetchUser, useMessage: useFetchUser } = createMessageState<
  { id: string },
  User
>('FETCH_USER');

export const { send: sendNotification, useMessage: useNotification } =
  createMessageState<{ message: string; type: 'success' | 'error' }>('SEND_NOTIFICATION');

// Use sender anywhere (all sends return promises)
await fetchUser({ id: '123' });
await sendNotification({ message: 'Task completed!', type: 'success' });

// Use hook in React components (defaultValue is optional)
function MyComponent() {
  const [userData] = useFetchUser({ id: '', name: '', email: '' }); // with default
  const [notification] = useNotification(); // without default

  return (
    <div>
      <p>User: {userData.name}</p>
      {notification && <div className={notification.type}>{notification.message}</div>}
    </div>
  );
}
```

### Message Effects

```tsx
import { createMessageEffect } from 'chrome-messenger/react';

// Create message effect - works like message listener with React hook
const { send: sendAnalytics, useMessageEffect } = createMessageEffect<
  { event: string; userId: string },
  { success: boolean; timestamp: number }
>('ANALYTICS');

function MyComponent() {
  const [count, setCount] = useState(0);

  // useAnalyticsEffect listens for sendAnalytics calls from anywhere in the app
  useAnalyticsEffect(async (data) => {
    console.log('Received analytics event:', data);

    // Can be async or sync - return response data
    const result = await processAnalytics(data);

    return {
      success: true,
      timestamp: Date.now(),
    };
  }, []);

  // Sync callback example
  useAnalyticsEffect(
    (data) => {
      console.log('Sync processing:', data);
      return { success: true, timestamp: Date.now() };
    },
    [count],
  ); // Dependencies work like useEffect

  const handleClick = () => {
    setCount((c) => c + 1);

    // Send analytics data - triggers useAnalyticsEffect listeners (returns Promise)
    sendAnalytics({
      event: 'button_clicked',
      userId: 'user123',
    });
  };

  return <button onClick={handleClick}>Count: {count}</button>;
}

// In another component or file
function AnotherComponent() {
  // This will also trigger the useAnalyticsEffect listeners above
  const trackPageView = () => {
    sendAnalytics({
      event: 'page_view',
      userId: 'user123',
    });
  };

  return <button onClick={trackPageView}>Track Page View</button>;
}
```

## Tab and Window Messaging

```typescript
// Send to specific tab
fetchUser({ id: '123' }, { tabId: 123 });

// Send to specific window (messages filtered automatically)
sendNotification({ message: 'hello', type: 'success' }, { windowId: 456 });

// Send to external extension
sendNotification({ message: 'hello', type: 'success' }, { extensionId: 'extension-id' });
```

### Window Filtering

When you specify a `windowId` option, messages are automatically filtered by the receiving window. This eliminates the need for manual window ID comparisons in your message handlers.

**Before (manual filtering):**

```typescript
const { onMessage } = createMessage('myMessage');
onMessage((data, sender) => {
  // Manual window check required
  chrome.windows.getCurrent((currentWindow) => {
    if (currentWindow.id !== expectedWindowId) return;
    console.log('Success');
    // Handle message
  });
});
```

**After (automatic filtering):**

```typescript
const { onMessage } = createMessage('myMessage');
// Sender specifies window
send(data, { windowId: 123 });

// Receiver automatically filters - no manual check needed
onMessage((data, sender) => {
  // Only executes if current window matches windowId: 123
  // Handle message
});
```

## Features

- 🔒 **Type Safety**: Full TypeScript support with automatic type inference
- ⚛️ **React Hooks**: Optional React integration with automatic cleanup
- 🎯 **Always Asynchronous**: All sends return `Promise<void>` or `Promise<T>` for responses
- 🧹 **Auto Cleanup**: All listeners return disposal functions
- 📦 **Zero Dependencies**: Lightweight with no external dependencies
- ⚡ **Message Effects**: Listener-based hooks that respond to messages from anywhere in the app

## API Reference

### Core Functions

- `createMessage<Data, ReturnValue>(identifier)` - Creates message sender/listener pair
- `createExternalMessage<Data, ReturnValue>(identifier)` - For external extension communication

### React Hooks

- `createMessageState<Data, ReturnValue>(identifier)` - Returns `{ send, useMessage }` object for state-based messaging
- `createMessageEffect<Data, ReturnValue>(identifier)` - Returns `{ send, useMessageEffect }` object for listener-based messaging

### Hook Usage

```tsx
// Message hooks (state-based)
function Component() {
  const [data] = useHook(); // No default value
  const [data] = useHook(defaultValue); // With default value

  return <div>{JSON.stringify(data)}</div>;
}

// Message effect hooks (listener-based)
function Component() {
  useMessageEffect((data) => {
    // Handle incoming message data
    console.log(data);
    return response; // Optional response
  }); // No dependencies

  useMessageEffect(callback, [dep1, dep2]); // With dependencies

  return <div>Listening for messages...</div>;
}
```

### Options

- `tabId: number` - Send to specific tab
- `windowId: number` - Send to specific window with automatic filtering
- `extensionId: string` - Send to external extension

---

**Happy messaging!** 🚀
