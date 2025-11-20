import { beforeEach, describe, expect, it, vi } from 'vitest';

import { onWindowClose } from '../src/on-window-close';

// Mock chrome API
const mockChrome = {
  windows: {
    onRemoved: {
      addListener: vi.fn(),
    },
  },
};

// Setup global chrome mock
beforeEach(() => {
  vi.stubGlobal('chrome', mockChrome);
});

describe('onWindowClose', () => {
  it('should register a callback and call it when window is removed', () => {
    const callback = vi.fn();
    const windowId = 123;

    // Register the callback
    const unsubscribe = onWindowClose(windowId, callback);

    // Verify listener was added
    expect(mockChrome.windows.onRemoved.addListener).toHaveBeenCalledTimes(1);

    // Get the listener that was added
    const listener = mockChrome.windows.onRemoved.addListener.mock.calls[0]![0];

    // Simulate window removal
    listener(windowId);

    // Verify callback was called
    expect(callback).toHaveBeenCalledTimes(1);

    // Cleanup
    unsubscribe();
  });

  it('should support multiple callbacks for the same window', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const windowId = 456;

    const unsubscribe1 = onWindowClose(windowId, callback1);
    const unsubscribe2 = onWindowClose(windowId, callback2);

    // Get the listener
    const listener = mockChrome.windows.onRemoved.addListener.mock.calls[0]![0];

    // Simulate window removal
    listener(windowId);

    // Both callbacks should be called
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);

    // Cleanup
    unsubscribe1();
    unsubscribe2();
  });

  it('should allow unsubscribing from callbacks', () => {
    const callback = vi.fn();
    const windowId = 789;

    const unsubscribe = onWindowClose(windowId, callback);

    // Unsubscribe
    unsubscribe();

    // Get the listener
    const listener = mockChrome.windows.onRemoved.addListener.mock.calls[0]![0];

    // Simulate window removal
    listener(windowId);

    // Callback should not be called since unsubscribed
    expect(callback).not.toHaveBeenCalled();
  });

  it('should not call callbacks for different window IDs', () => {
    const callback = vi.fn();
    const windowId = 101;
    const differentWindowId = 999;

    onWindowClose(windowId, callback);

    // Get the listener
    const listener = mockChrome.windows.onRemoved.addListener.mock.calls[0]![0];

    // Simulate removal of a different window
    listener(differentWindowId);

    // Callback should not be called
    expect(callback).not.toHaveBeenCalled();
  });

  it('should clean up listeners when all callbacks are unsubscribed', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const windowId = 202;

    const unsubscribe1 = onWindowClose(windowId, callback1);
    const unsubscribe2 = onWindowClose(windowId, callback2);

    // Both unsubscribe
    unsubscribe1();
    unsubscribe2();

    const listener = mockChrome.windows.onRemoved.addListener.mock.calls[0]![0];

    // Simulate window removal
    listener(windowId);

    // Neither callback should be called
    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).not.toHaveBeenCalled();
  });
});
