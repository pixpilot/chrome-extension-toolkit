import { beforeEach, describe, expect, it, vi } from 'vitest';
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
};

// Mock window
const mockWindow = {
  close: vi.fn(),
};

const HEARTBEAT_INTERVAL_MS = 15000;

describe('initializeSidePanelStateTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error - Mocking global objects
    globalThis.chrome = mockChrome;
    // @ts-expect-error - Mocking global objects
    globalThis.document = mockDocument;
    // @ts-expect-error - Mocking global objects
    globalThis.window = mockWindow;
    vi.resetModules();
  });

  it('should initialize the side panel state tracker', () => {
    // Mock chrome.windows.getCurrent to call the callback with a window
    mockChrome.windows.getCurrent.mockImplementation((callback) => {
      callback({ id: 123 });
    });

    // Mock chrome.runtime.connect to return a mock port
    const mockPort = {
      postMessage: vi.fn(),
      onDisconnect: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn(),
      },
    };
    mockChrome.runtime.connect.mockReturnValue(mockPort);

    initializeSidePanelStateTracker();

    // Verify chrome.windows.getCurrent was called
    expect(mockChrome.windows.getCurrent).toHaveBeenCalled();

    // Verify chrome.runtime.connect was called
    expect(mockChrome.runtime.connect).toHaveBeenCalledWith({
      name: 'test-extension-id',
    });

    // Verify document.addEventListener was called for visibilitychange
    expect(mockDocument.addEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );

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

    initializeSidePanelStateTracker();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[side-panel-state-tracker] Could not get window ID',
    );

    consoleErrorSpy.mockRestore();
  });

  it('should send heartbeat messages', () => {
    vi.useFakeTimers();

    // Mock chrome.windows.getCurrent
    mockChrome.windows.getCurrent.mockImplementation((callback) => {
      callback({ id: 123 });
    });

    // Mock chrome.runtime.connect
    const mockPort = {
      postMessage: vi.fn(),
      onDisconnect: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn(),
      },
    };
    mockChrome.runtime.connect.mockReturnValue(mockPort);

    initializeSidePanelStateTracker();

    // Advance time by heartbeat interval
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);

    expect(mockPort.postMessage).toHaveBeenCalledWith({
      type: 'side-panel-heartbeat',
      windowId: 123,
      timestamp: expect.any(Number),
    });

    vi.useRealTimers();
  });

  it('should handle visibility change to hidden', () => {
    // Mock chrome.windows.getCurrent
    mockChrome.windows.getCurrent.mockImplementation((callback) => {
      callback({ id: 123 });
    });

    // Mock chrome.runtime.connect
    const mockPort = {
      postMessage: vi.fn(),
      onDisconnect: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn(),
      },
    };
    mockChrome.runtime.connect.mockReturnValue(mockPort);

    initializeSidePanelStateTracker();

    // Get the visibilitychange listener
    const visibilityChangeCallback = mockDocument.addEventListener.mock.calls.find(
      (call) => call[0] === 'visibilitychange',
    )![1];

    // Simulate visibility change to hidden
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
      onDisconnect: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn(),
      },
    };
    mockChrome.runtime.connect.mockReturnValue(mockPort);

    initializeSidePanelStateTracker();

    // Get the onMessage listener
    const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0]?.[0];

    if (!onMessageCallback) {
      throw new Error('onMessage listener not set');
    }

    // Simulate close-side-panel message
    onMessageCallback({ type: 'close-side-panel' });

    expect(mockWindow.close).toHaveBeenCalled();
  });
});
