# @pixpilot/chrome-testing-tools

A package providing mocks for Chrome extension APIs to facilitate testing with Vitest.

## Usage

Import the mocks in your test setup:

```typescript
import '@pixpilot/chrome-testing-tools';
```

This will set up global mocks for `chrome` and `browser` APIs.

### Advanced Usage

You can also import the mock objects directly for more control:

```typescript
import { mockBrowser, mockChrome } from '@pixpilot/chrome-testing-tools';

describe('my extension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should send a message', async () => {
    mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
      callback({ result: 'success' });
    });

    // Your extension code that calls chrome.runtime.sendMessage
    const result = await sendMessage({ type: 'test' });

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'test' },
      expect.any(Function),
    );
    expect(result).toEqual({ result: 'success' });
  });
});
```

The mocks include:

- `chrome.runtime.sendMessage`
- `chrome.runtime.onMessage`
- `chrome.tabs.sendMessage`
- `chrome.windows.getCurrent`
- And corresponding `browser` APIs for Firefox compatibility.
