import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeSidePanelStateTracker } from '../src/side-panel-state-tracker';

// Mock Chrome APIs
const mockChrome = {
  windows: {
    getCurrent: vi.fn(),
  },
  runtime: {
    id: 'test-extension-id',
    connect: vi.fn(),
  },
};

// Mock document
const mockDocument = {
  hidden: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

// Mock window
const mockWindow = {
  close: vi.fn(),
};

const INITIAL_RECONNECT_DELAY_MS = 250;
const SECOND_RECONNECT_DELAY_MS = 500;
const EXPECTED_CONNECT_CALLS_AFTER_RECONNECT = 2;
const EXPECTED_CONNECT_CALLS_AFTER_SECOND_RECONNECT = 3;

describe('initializeSidePanelStateTracker', () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDocument.hidden = false;
    cleanup = undefined;
    // @ts-expect-error - Mocking global objects
    globalThis.chrome = mockChrome;
    // @ts-expect-error - Mocking global objects
    globalThis.document = mockDocument;
    // @ts-expect-error - Mocking global objects
    globalThis.window = mockWindow;
    vi.resetModules();
  });

  afterEach(() => {
    cleanup?.();
    vi.useRealTimers();
  });

  it('should initialize the side panel state tracker', () => {
    // Mock chrome.windows.getCurrent to call the callback with a window
    mockChrome.windows.getCurrent.mockImplementation((callback) => {
      callback({ id: 123 });
    });

    // Mock chrome.runtime.connect to return a mock port
    const mockPort = {
      postMessage: vi.fn(),
      disconnect: vi.fn(),
      onDisconnect: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn(),
      },
    };
    mockChrome.runtime.connect.mockReturnValue(mockPort);

    cleanup = initializeSidePanelStateTracker();

    // Verify chrome.windows.getCurrent was called
    expect(mockChrome.windows.getCurrent).toHaveBeenCalled();

    // Verify chrome.runtime.connect was called
    expect(mockChrome.runtime.connect).toHaveBeenCalledWith({
      name: 'test-extension-id',
    });

    // Verify initial state was sent
    expect(mockPort.postMessage).toHaveBeenCalledWith({
      state: 'visible',
      reason: 'document-load',
      windowId: 123,
      type: 'side-panel-state-tracker',
      timestamp: expect.any(Number),
    });
  });

  it('should handle window ID being null', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock chrome.windows.getCurrent to call the callback with null id
    mockChrome.windows.getCurrent.mockImplementation((callback) => {
      callback({ id: null });
    });

    cleanup = initializeSidePanelStateTracker();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[side-panel-state-tracker] Could not get window ID',
    );

    consoleErrorSpy.mockRestore();
  });

  it('should not connect if cleanup runs before chrome.windows.getCurrent returns', () => {
    let getCurrentCallback: ((win: { id: number }) => void) | undefined;

    mockChrome.windows.getCurrent.mockImplementation((callback) => {
      getCurrentCallback = callback;
    });

    cleanup = initializeSidePanelStateTracker();
    cleanup();
    cleanup = undefined;

    getCurrentCallback?.({ id: 123 });

    expect(mockChrome.runtime.connect).not.toHaveBeenCalled();
  });

  it('should announce visible on load even when document visibility tracking starts hidden', () => {
    // Mock chrome.windows.getCurrent
    mockChrome.windows.getCurrent.mockImplementation((callback) => {
      callback({ id: 123 });
    });

    // Mock chrome.runtime.connect
    const mockPort = {
      postMessage: vi.fn(),
      disconnect: vi.fn(),
      onDisconnect: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn(),
      },
    };
    mockChrome.runtime.connect.mockReturnValue(mockPort);

    mockDocument.hidden = true;

    cleanup = initializeSidePanelStateTracker();

    expect(mockPort.postMessage).toHaveBeenCalledWith({
      state: 'visible',
      reason: 'document-load',
      windowId: 123,
      type: 'side-panel-state-tracker',
      timestamp: expect.any(Number),
    });
  });

  it('should announce visible on load when document visibility tracking is disabled', () => {
    mockChrome.windows.getCurrent.mockImplementation((callback) => {
      callback({ id: 123 });
    });

    const mockPort = {
      postMessage: vi.fn(),
      disconnect: vi.fn(),
      onDisconnect: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn(),
      },
    };
    mockChrome.runtime.connect.mockReturnValue(mockPort);

    mockDocument.hidden = true;

    cleanup = initializeSidePanelStateTracker({
      trackDocumentVisibility: false,
    });

    expect(mockDocument.addEventListener).not.toHaveBeenCalled();
    expect(mockPort.postMessage).toHaveBeenCalledWith({
      state: 'visible',
      reason: 'document-load',
      windowId: 123,
      type: 'side-panel-state-tracker',
      timestamp: expect.any(Number),
    });
  });

  it('should report visibility changes when document visibility tracking is enabled', () => {
    mockChrome.windows.getCurrent.mockImplementation((callback) => {
      callback({ id: 123 });
    });

    const mockPort = {
      postMessage: vi.fn(),
      disconnect: vi.fn(),
      onDisconnect: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn(),
      },
    };
    mockChrome.runtime.connect.mockReturnValue(mockPort);

    cleanup = initializeSidePanelStateTracker();

    const visibilityChangeCallback = mockDocument.addEventListener.mock.calls.find(
      (call) => call[0] === 'visibilitychange',
    )?.[1];

    if (!visibilityChangeCallback) {
      throw new Error('visibilitychange listener not set');
    }

    mockDocument.hidden = true;
    visibilityChangeCallback();

    expect(mockPort.postMessage).toHaveBeenCalledWith({
      state: 'hidden',
      reason: 'visibility-change',
      windowId: 123,
      type: 'side-panel-state-tracker',
      timestamp: expect.any(Number),
    });
  });

  it('should close window on close-side-panel message', () => {
    // Mock chrome.windows.getCurrent
    mockChrome.windows.getCurrent.mockImplementation((callback) => {
      callback({ id: 123 });
    });

    // Mock chrome.runtime.connect
    const mockPort = {
      postMessage: vi.fn(),
      disconnect: vi.fn(),
      onDisconnect: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn(),
      },
    };
    mockChrome.runtime.connect.mockReturnValue(mockPort);

    cleanup = initializeSidePanelStateTracker();

    // Get the onMessage listener
    const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0]?.[0];

    if (!onMessageCallback) {
      throw new Error('onMessage listener not set');
    }

    // Simulate close-side-panel message
    onMessageCallback({ type: 'close-side-panel' });

    expect(mockWindow.close).toHaveBeenCalled();
  });

  it('should reconnect and resend visible state when the background port disconnects', () => {
    vi.useFakeTimers();
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockChrome.windows.getCurrent.mockImplementation((callback) => {
      callback({ id: 123 });
    });

    const disconnectedPort = {
      postMessage: vi.fn(),
      disconnect: vi.fn(),
      onDisconnect: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn(),
      },
    };
    const reconnectedPort = {
      postMessage: vi.fn(),
      disconnect: vi.fn(),
      onDisconnect: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn(),
      },
    };

    mockChrome.runtime.connect
      .mockReturnValueOnce(disconnectedPort)
      .mockReturnValueOnce(reconnectedPort);

    cleanup = initializeSidePanelStateTracker();

    const onDisconnectCallback =
      disconnectedPort.onDisconnect.addListener.mock.calls[0]?.[0];

    if (!onDisconnectCallback) {
      throw new Error('onDisconnect listener not set');
    }

    onDisconnectCallback();
    vi.advanceTimersByTime(INITIAL_RECONNECT_DELAY_MS);

    expect(mockChrome.runtime.connect).toHaveBeenCalledTimes(
      EXPECTED_CONNECT_CALLS_AFTER_RECONNECT,
    );
    expect(reconnectedPort.postMessage).toHaveBeenCalledWith({
      state: 'visible',
      reason: 'reconnected',
      windowId: 123,
      type: 'side-panel-state-tracker',
      timestamp: expect.any(Number),
    });

    consoleWarnSpy.mockRestore();
  });

  it('should reset reconnect backoff after a successful connection', () => {
    vi.useFakeTimers();
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockChrome.windows.getCurrent.mockImplementation((callback) => {
      callback({ id: 123 });
    });

    const firstPort = {
      postMessage: vi.fn(),
      disconnect: vi.fn(),
      onDisconnect: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn(),
      },
    };
    const secondPort = {
      postMessage: vi.fn(),
      disconnect: vi.fn(),
      onDisconnect: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn(),
      },
    };
    const thirdPort = {
      postMessage: vi.fn(),
      disconnect: vi.fn(),
      onDisconnect: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn(),
      },
    };

    mockChrome.runtime.connect
      .mockReturnValueOnce(firstPort)
      .mockReturnValueOnce(secondPort)
      .mockReturnValueOnce(thirdPort);

    cleanup = initializeSidePanelStateTracker();

    const firstDisconnect = firstPort.onDisconnect.addListener.mock.calls[0]?.[0];

    if (!firstDisconnect) {
      throw new Error('first onDisconnect listener not set');
    }

    firstDisconnect();
    vi.advanceTimersByTime(INITIAL_RECONNECT_DELAY_MS);

    const secondDisconnect = secondPort.onDisconnect.addListener.mock.calls[0]?.[0];

    if (!secondDisconnect) {
      throw new Error('second onDisconnect listener not set');
    }

    secondDisconnect();
    vi.advanceTimersByTime(INITIAL_RECONNECT_DELAY_MS);

    expect(mockChrome.runtime.connect).toHaveBeenCalledTimes(
      EXPECTED_CONNECT_CALLS_AFTER_SECOND_RECONNECT,
    );

    consoleWarnSpy.mockRestore();
  });

  it('should back off when connection attempts throw', () => {
    vi.useFakeTimers();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockChrome.windows.getCurrent.mockImplementation((callback) => {
      callback({ id: 123 });
    });

    const recoveredPort = {
      postMessage: vi.fn(),
      disconnect: vi.fn(),
      onDisconnect: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn(),
      },
    };

    mockChrome.runtime.connect
      .mockImplementationOnce(() => {
        throw new Error('connect failed');
      })
      .mockImplementationOnce(() => {
        throw new Error('connect failed again');
      })
      .mockReturnValueOnce(recoveredPort);

    cleanup = initializeSidePanelStateTracker();

    vi.advanceTimersByTime(INITIAL_RECONNECT_DELAY_MS);

    expect(mockChrome.runtime.connect).toHaveBeenCalledTimes(
      EXPECTED_CONNECT_CALLS_AFTER_RECONNECT,
    );

    vi.advanceTimersByTime(INITIAL_RECONNECT_DELAY_MS);

    expect(mockChrome.runtime.connect).toHaveBeenCalledTimes(
      EXPECTED_CONNECT_CALLS_AFTER_RECONNECT,
    );

    vi.advanceTimersByTime(SECOND_RECONNECT_DELAY_MS - INITIAL_RECONNECT_DELAY_MS);

    expect(mockChrome.runtime.connect).toHaveBeenCalledTimes(
      EXPECTED_CONNECT_CALLS_AFTER_SECOND_RECONNECT,
    );
    expect(recoveredPort.postMessage).toHaveBeenCalledWith({
      state: 'visible',
      reason: 'reconnected',
      windowId: 123,
      type: 'side-panel-state-tracker',
      timestamp: expect.any(Number),
    });

    consoleErrorSpy.mockRestore();
  });
});
