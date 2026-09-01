import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Chrome APIs
const mockChrome = {
  action: {
    onClicked: {
      addListener: vi.fn(),
    },
  },
  sidePanel: {
    open: vi.fn().mockResolvedValue(undefined),
  },
  runtime: {
    id: 'test-extension-id',
    onConnect: {
      addListener: vi.fn(),
    },
  },
  windows: {
    onRemoved: {
      addListener: vi.fn(),
    },
  },
};

// Mock Port
const mockPort = {
  name: 'test-extension-id',
  onMessage: {
    addListener: vi.fn(),
  },
  onDisconnect: {
    addListener: vi.fn(),
  },
  postMessage: vi.fn(),
};

// Helper function to import and initialize the side panel manager
function importAndInit() {
  return import('../src/sidepanel-state-manager').then((module) => {
    module.initSidePanelStateManager();
    return module;
  });
}

interface EmitOptions {
  state: 'visible' | 'hidden';
  windowId: number;
  reason?: string;
  type?: string;
}

/**
 * Initializes the manager behind a freshly connected port and returns an `emit`
 * helper that feeds it tracker messages the way a side panel document would.
 */
async function setupManager() {
  const {
    getSidePanelStateForWindow,
    onSidePanelHidden,
    onSidePanelShown,
    onSidePanelStateChange,
  } = await importAndInit();

  const onConnectCallback = mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;
  const port = {
    name: 'test-extension-id',
    onMessage: { addListener: vi.fn() },
    onDisconnect: { addListener: vi.fn() },
    postMessage: vi.fn(),
  };
  onConnectCallback(port);

  const handleMessage = port.onMessage.addListener.mock.calls[0]![0]!;

  function emit({
    state,
    windowId,
    reason = 'test',
    type = 'side-panel-state-tracker',
  }: EmitOptions) {
    handleMessage({ type, state, reason, windowId });
  }

  return {
    emit,
    port,
    getSidePanelStateForWindow,
    onSidePanelHidden,
    onSidePanelShown,
    onSidePanelStateChange,
  };
}

async function setupWithListener(options?: { includeRepeats?: boolean }) {
  const setup = await setupManager();
  const listener = vi.fn();
  setup.onSidePanelStateChange(listener, options);

  return { ...setup, listener };
}

async function setupWithTransitionListeners() {
  const setup = await setupManager();
  const shown = vi.fn();
  const hidden = vi.fn();

  return {
    ...setup,
    shown,
    hidden,
    unsubscribeShown: setup.onSidePanelShown(shown),
    unsubscribeHidden: setup.onSidePanelHidden(hidden),
  };
}

describe('sidepanel-state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error - Mocking global chrome object
    globalThis.chrome = mockChrome;
    // Reset the module to clear internal state
    vi.resetModules();
  });

  describe('initialization', () => {
    it('should set up chrome.action.onClicked listener', async () => {
      await importAndInit();
      expect(mockChrome.action.onClicked.addListener).toHaveBeenCalled();
    });

    it('should set up chrome.runtime.onConnect listener', async () => {
      await importAndInit();
      expect(mockChrome.runtime.onConnect.addListener).toHaveBeenCalled();
    });
  });

  describe('getSidePanelStateForWindow', () => {
    it('should initialize when not initialized', async () => {
      const { getSidePanelStateForWindow } = await import(
        '../src/sidepanel-state-manager'
      );
      getSidePanelStateForWindow(123);
      expect(mockChrome.action.onClicked.addListener).toHaveBeenCalled();
      expect(mockChrome.runtime.onConnect.addListener).toHaveBeenCalled();
    });

    it('should return undefined for non-existent window', async () => {
      const { getSidePanelStateForWindow } = await importAndInit();
      expect(getSidePanelStateForWindow(123)).toBeUndefined();
    });

    it('should return state for existing window', async () => {
      const { getSidePanelStateForWindow } = await importAndInit();

      // Simulate connection and message
      expect(mockChrome.runtime.onConnect.addListener).toHaveBeenCalled();
      const onConnectCallback =
        mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;
      onConnectCallback(mockPort);

      expect(mockPort.onMessage.addListener).toHaveBeenCalled();
      const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0]![0]!;
      onMessageCallback({
        type: 'side-panel-state-tracker',
        state: 'visible',
        reason: 'test',
        windowId: 123,
      });

      expect(getSidePanelStateForWindow(123)).toBe('visible');
    });
  });

  describe('isWindowSidePanelVisible', () => {
    it('should initialize when not initialized', async () => {
      const { isWindowSidePanelVisible } = await import('../src/sidepanel-state-manager');
      isWindowSidePanelVisible(123);
      expect(mockChrome.action.onClicked.addListener).toHaveBeenCalled();
      expect(mockChrome.runtime.onConnect.addListener).toHaveBeenCalled();
    });

    it('should return false for non-existent window', async () => {
      const { isWindowSidePanelVisible } = await importAndInit();
      expect(isWindowSidePanelVisible(123)).toBe(false);
    });

    it('should return true for visible sidepanel', async () => {
      const { isWindowSidePanelVisible } = await importAndInit();

      const onConnectCallback =
        mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;
      onConnectCallback(mockPort);

      expect(mockPort.onMessage.addListener).toHaveBeenCalled();
      const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0]![0]!;
      onMessageCallback({
        type: 'side-panel-state-tracker',
        state: 'visible',
        reason: 'test',
        windowId: 123,
      });

      expect(isWindowSidePanelVisible(123)).toBe(true);
    });

    it('should return false for hidden sidepanel', async () => {
      const { isWindowSidePanelVisible } = await importAndInit();

      const onConnectCallback =
        mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;
      onConnectCallback(mockPort);

      expect(mockPort.onMessage.addListener).toHaveBeenCalled();
      const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0]![0]!;
      onMessageCallback({
        type: 'side-panel-state-tracker',
        state: 'hidden',
        reason: 'test',
        windowId: 123,
      });

      expect(isWindowSidePanelVisible(123)).toBe(false);
    });
  });

  describe('chrome.action.onClicked', () => {
    it('should open sidepanel when no sidepanel exists for window', async () => {
      await importAndInit();

      const onClickedCallback =
        mockChrome.action.onClicked.addListener.mock.calls[0]![0]!;
      const mockTab = { windowId: 123 };

      onClickedCallback(mockTab);

      expect(mockChrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 123 });
    });

    it('should close sidepanel when sidepanel is visible', async () => {
      await importAndInit();

      // Set up visible sidepanel
      const onConnectCallback =
        mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;
      onConnectCallback(mockPort);

      expect(mockPort.onMessage.addListener).toHaveBeenCalled();
      const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0]![0]!;
      onMessageCallback({
        type: 'side-panel-state-tracker',
        state: 'visible',
        reason: 'test',
        windowId: 123,
      });

      const onClickedCallback =
        mockChrome.action.onClicked.addListener.mock.calls[0]![0]!;
      const mockTab = { windowId: 123 };

      onClickedCallback(mockTab);

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'close-side-panel',
      });
    });

    it('should open sidepanel when sidepanel is hidden', async () => {
      await importAndInit();

      // Set up hidden sidepanel
      const onConnectCallback =
        mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;
      onConnectCallback(mockPort);

      expect(mockPort.onMessage.addListener).toHaveBeenCalled();
      const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0]![0]!;
      onMessageCallback({
        type: 'side-panel-state-tracker',
        state: 'hidden',
        reason: 'test',
        windowId: 123,
      });

      const onClickedCallback =
        mockChrome.action.onClicked.addListener.mock.calls[0]![0]!;
      const mockTab = { windowId: 123 };

      onClickedCallback(mockTab);

      expect(mockChrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 123 });
    });
  });

  describe('chrome.runtime.onConnect', () => {
    it('should ignore connections with wrong port name', async () => {
      await importAndInit();

      const wrongPort = { ...mockPort, name: 'wrong-name' };
      const onConnectCallback =
        mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;

      onConnectCallback(wrongPort);

      expect(mockPort.onMessage.addListener).not.toHaveBeenCalled();
    });

    it('should set up listeners for correct port name', async () => {
      await importAndInit();

      const onConnectCallback =
        mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;

      onConnectCallback(mockPort);

      expect(mockPort.onMessage.addListener).toHaveBeenCalled();
      expect(mockPort.onDisconnect.addListener).toHaveBeenCalled();
    });
  });

  describe('port message handling', () => {
    it('should ignore messages with wrong type', async () => {
      await importAndInit();

      const onConnectCallback =
        mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;
      onConnectCallback(mockPort);

      const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0]![0]!;

      onMessageCallback({
        type: 'wrong-type',
        state: 'visible',
        reason: 'test',
        windowId: 123,
      });

      const { getSidePanelStateForWindow } = await import(
        '../src/sidepanel-state-manager'
      );
      expect(getSidePanelStateForWindow(123)).toBeUndefined();
    });

    it('should set sidepanel state for correct message type', async () => {
      await importAndInit();

      const onConnectCallback =
        mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;
      onConnectCallback(mockPort);

      const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0]![0]!;

      onMessageCallback({
        type: 'side-panel-state-tracker',
        state: 'visible',
        reason: 'test',
        windowId: 123,
      });

      const { getSidePanelStateForWindow } = await import(
        '../src/sidepanel-state-manager'
      );
      expect(getSidePanelStateForWindow(123)).toBe('visible');
    });

    it('should remove sidepanel when state is hidden', async () => {
      await importAndInit();

      // First set to visible
      const onConnectCallback =
        mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;
      onConnectCallback(mockPort);

      const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0]![0]!;
      onMessageCallback({
        type: 'side-panel-state-tracker',
        state: 'visible',
        reason: 'test',
        windowId: 123,
      });

      const { getSidePanelStateForWindow } = await import(
        '../src/sidepanel-state-manager'
      );
      expect(getSidePanelStateForWindow(123)).toBe('visible');

      // Then set to hidden
      onMessageCallback({
        type: 'side-panel-state-tracker',
        state: 'hidden',
        reason: 'test',
        windowId: 123,
      });

      expect(getSidePanelStateForWindow(123)).toBeUndefined();
    });

    it('should use default reason when not provided', async () => {
      await importAndInit();

      const onConnectCallback =
        mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;
      onConnectCallback(mockPort);

      const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0]![0]!;

      onMessageCallback({
        type: 'side-panel-state-tracker',
        state: 'visible',
        windowId: 123,
      });

      const { getSidePanelStateForWindow } = await import(
        '../src/sidepanel-state-manager'
      );
      expect(getSidePanelStateForWindow(123)).toBe('visible');
    });
  });

  describe('port disconnect handling', () => {
    it('should remove port from sidepanels map on disconnect', async () => {
      await importAndInit();

      const onConnectCallback =
        mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;
      onConnectCallback(mockPort);

      const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0]![0]!;
      onMessageCallback({
        type: 'side-panel-state-tracker',
        state: 'visible',
        reason: 'test',
        windowId: 123,
      });

      const { getSidePanelStateForWindow } = await import(
        '../src/sidepanel-state-manager'
      );
      expect(getSidePanelStateForWindow(123)).toBe('visible');

      const onDisconnectCallback = mockPort.onDisconnect.addListener.mock.calls[0]![0]!;
      onDisconnectCallback(mockPort);

      expect(getSidePanelStateForWindow(123)).toBeUndefined();
    });

    it('should handle disconnect for non-existent port', async () => {
      await importAndInit();

      const onConnectCallback =
        mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;
      onConnectCallback(mockPort);

      const onDisconnectCallback = mockPort.onDisconnect.addListener.mock.calls[0]![0]!;
      const differentPort = { ...mockPort, name: 'different' };

      // Should not throw
      expect(() => onDisconnectCallback(differentPort)).not.toThrow();
    });
  });

  describe('multiple windows', () => {
    it('should handle multiple windows independently', async () => {
      await importAndInit();

      const onConnectCallback =
        mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;

      // Window 1
      const port1 = { ...mockPort };
      onConnectCallback(port1);
      const onMessageCallback1 = port1.onMessage.addListener.mock.calls[0]![0]!;
      onMessageCallback1({
        type: 'side-panel-state-tracker',
        state: 'visible',
        reason: 'test',
        windowId: 123,
      });

      // Window 2
      const port2 = { ...mockPort };
      onConnectCallback(port2);
      const onMessageCallback2 = port2.onMessage.addListener.mock.calls[0]![0]!;
      onMessageCallback2({
        type: 'side-panel-state-tracker',
        state: 'hidden',
        reason: 'test',
        windowId: 456,
      });

      const { getSidePanelStateForWindow, isWindowSidePanelVisible } = await import(
        '../src/sidepanel-state-manager'
      );
      expect(getSidePanelStateForWindow(123)).toBe('visible');
      expect(getSidePanelStateForWindow(456)).toBeUndefined();
      expect(isWindowSidePanelVisible(123)).toBe(true);
      expect(isWindowSidePanelVisible(456)).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle chrome.sidePanel.open errors gracefully', async () => {
      await importAndInit();

      mockChrome.sidePanel.open.mockRejectedValue(new Error('Open failed'));

      const onClickedCallback =
        mockChrome.action.onClicked.addListener.mock.calls[0]![0]!;
      const mockTab = { windowId: 123 };

      // Should not throw
      expect(() => onClickedCallback(mockTab)).not.toThrow();
      expect(mockChrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 123 });
    });
  });

  describe('edge cases', () => {
    it('should handle undefined windowId', async () => {
      const { getSidePanelStateForWindow, isWindowSidePanelVisible } =
        await importAndInit();
      expect(getSidePanelStateForWindow(undefined as any)).toBeUndefined();
      expect(isWindowSidePanelVisible(undefined as any)).toBe(false);
    });

    it('should handle null windowId', async () => {
      const { getSidePanelStateForWindow, isWindowSidePanelVisible } =
        await importAndInit();
      expect(getSidePanelStateForWindow(null as any)).toBeUndefined();
      expect(isWindowSidePanelVisible(null as any)).toBe(false);
    });

    it('should handle negative windowId', async () => {
      const { getSidePanelStateForWindow, isWindowSidePanelVisible } =
        await importAndInit();
      expect(getSidePanelStateForWindow(-1)).toBeUndefined();
      expect(isWindowSidePanelVisible(-1)).toBe(false);
    });

    it('should handle message without state property', async () => {
      await importAndInit();

      const onConnectCallback =
        mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;
      onConnectCallback(mockPort);

      const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0]![0]!;

      onMessageCallback({
        type: 'side-panel-state-tracker',
        reason: 'test',
        windowId: 123,
        // state omitted
      });

      const { getSidePanelStateForWindow } = await import(
        '../src/sidepanel-state-manager'
      );
      expect(getSidePanelStateForWindow(123)).toBeUndefined();
    });
  });

  describe('state change listeners', () => {
    it('should initialize when not initialized', async () => {
      const { onSidePanelStateChange } = await import('../src/sidepanel-state-manager');
      const listener = vi.fn();
      onSidePanelStateChange(listener);
      expect(mockChrome.action.onClicked.addListener).toHaveBeenCalled();
      expect(mockChrome.runtime.onConnect.addListener).toHaveBeenCalled();
    });

    it('should add and notify listeners on state change', async () => {
      const { onSidePanelStateChange } = await importAndInit();

      const listener = vi.fn();
      onSidePanelStateChange(listener);

      const onConnectCallback =
        mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;
      onConnectCallback(mockPort);

      const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0]![0]!;
      onMessageCallback({
        type: 'side-panel-state-tracker',
        state: 'visible',
        reason: 'test',
        windowId: 123,
      });

      expect(listener).toHaveBeenCalledWith({
        state: 'visible',
        reason: 'test',
        windowId: 123,
        previousState: undefined,
      });
    });

    it('should notify listeners when state changes to hidden', async () => {
      const { onSidePanelStateChange } = await importAndInit();

      const listener = vi.fn();
      onSidePanelStateChange(listener);

      const onConnectCallback =
        mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;
      onConnectCallback(mockPort);

      const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0]![0]!;

      // First set to visible
      onMessageCallback({
        type: 'side-panel-state-tracker',
        state: 'visible',
        reason: 'test',
        windowId: 123,
      });

      expect(listener).toHaveBeenCalledTimes(1);

      // Then set to hidden
      onMessageCallback({
        type: 'side-panel-state-tracker',
        state: 'hidden',
        reason: 'visibility-change',
        windowId: 123,
      });

      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith({
        state: 'hidden',
        reason: 'visibility-change',
        windowId: 123,
        previousState: 'visible',
      });
    });

    it('should not notify listeners on heartbeat messages', async () => {
      const { onSidePanelStateChange } = await importAndInit();

      const listener = vi.fn();
      onSidePanelStateChange(listener);

      const onConnectCallback =
        mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;
      onConnectCallback(mockPort);

      const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0]![0]!;
      onMessageCallback({
        type: 'side-panel-heartbeat',
        state: 'visible',
        reason: 'heartbeat',
        windowId: 123,
      });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should exclude timestamp from listener data', async () => {
      const { onSidePanelStateChange } = await importAndInit();

      const listener = vi.fn();
      onSidePanelStateChange(listener);

      const onConnectCallback =
        mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;
      onConnectCallback(mockPort);

      const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0]![0]!;
      onMessageCallback({
        type: 'side-panel-state-tracker',
        state: 'visible',
        reason: 'test',
        windowId: 123,
        timestamp: Date.now(),
      });

      expect(listener).toHaveBeenCalledWith({
        state: 'visible',
        reason: 'test',
        windowId: 123,
        previousState: undefined,
      });
      expect(listener.mock.calls[0]![0]).not.toHaveProperty('timestamp');
      expect(listener.mock.calls[0]![0]).not.toHaveProperty('type');
    });

    it('should remove listener via unsubscribe function', async () => {
      const { onSidePanelStateChange } = await importAndInit();

      const listener = vi.fn();
      const unsubscribe = onSidePanelStateChange(listener);

      const onConnectCallback =
        mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;
      onConnectCallback(mockPort);

      const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0]![0]!;
      onMessageCallback({
        type: 'side-panel-state-tracker',
        state: 'visible',
        reason: 'test',
        windowId: 123,
      });

      expect(listener).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Should not be called again
      onMessageCallback({
        type: 'side-panel-state-tracker',
        state: 'hidden',
        reason: 'test',
        windowId: 123,
      });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should support multiple listeners', async () => {
      const { onSidePanelStateChange } = await importAndInit();

      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      onSidePanelStateChange(listener1);
      onSidePanelStateChange(listener2);
      onSidePanelStateChange(listener3);

      const onConnectCallback =
        mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;
      onConnectCallback(mockPort);

      const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0]![0]!;
      onMessageCallback({
        type: 'side-panel-state-tracker',
        state: 'visible',
        reason: 'test',
        windowId: 123,
      });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);

      expect(listener1).toHaveBeenCalledWith({
        state: 'visible',
        reason: 'test',
        windowId: 123,
        previousState: undefined,
      });
      expect(listener2).toHaveBeenCalledWith({
        state: 'visible',
        reason: 'test',
        windowId: 123,
        previousState: undefined,
      });
      expect(listener3).toHaveBeenCalledWith({
        state: 'visible',
        reason: 'test',
        windowId: 123,
        previousState: undefined,
      });
    });

    it('should handle listener errors gracefully', async () => {
      const { onSidePanelStateChange } = await importAndInit();

      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const normalListener = vi.fn();

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      onSidePanelStateChange(errorListener);
      onSidePanelStateChange(normalListener);

      const onConnectCallback =
        mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;
      onConnectCallback(mockPort);

      const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0]![0]!;
      onMessageCallback({
        type: 'side-panel-state-tracker',
        state: 'visible',
        reason: 'test',
        windowId: 123,
      });

      // Both listeners should have been called despite error
      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in side panel state listener:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle calling unsubscribe multiple times', async () => {
      const { onSidePanelStateChange } = await importAndInit();

      const listener = vi.fn();
      const unsubscribe = onSidePanelStateChange(listener);

      // Should not throw
      expect(() => unsubscribe()).not.toThrow();
      expect(() => unsubscribe()).not.toThrow();
      expect(() => unsubscribe()).not.toThrow();
    });

    it('should notify listeners on port disconnect', async () => {
      const { onSidePanelStateChange } = await importAndInit();

      const listener = vi.fn();
      onSidePanelStateChange(listener);

      const onConnectCallback =
        mockChrome.runtime.onConnect.addListener.mock.calls[0]![0]!;
      onConnectCallback(mockPort);

      const onMessageCallback = mockPort.onMessage.addListener.mock.calls[0]![0]!;
      onMessageCallback({
        type: 'side-panel-state-tracker',
        state: 'visible',
        reason: 'test',
        windowId: 123,
      });

      expect(listener).toHaveBeenCalledTimes(1);
      listener.mockClear();

      // Disconnect port
      const onDisconnectCallback = mockPort.onDisconnect.addListener.mock.calls[0]![0]!;
      onDisconnectCallback(mockPort);

      // Should notify listener about hidden state
      expect(listener).toHaveBeenCalledWith({
        state: 'hidden',
        reason: 'port-disconnected',
        windowId: 123,
        previousState: 'visible',
      });
    });
  });

  describe('repeated state reports', () => {
    it('should not notify when a report repeats the known state', async () => {
      const { emit, listener } = await setupWithListener();

      emit({ state: 'visible', windowId: 123, reason: 'document-load' });
      emit({ state: 'visible', windowId: 123, reason: 'reconnected' });
      emit({ state: 'visible', windowId: 123, reason: 'visibility-change' });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        state: 'visible',
        reason: 'document-load',
        windowId: 123,
        previousState: undefined,
      });
    });

    it('should not notify for a second hidden report in a row', async () => {
      const { emit, listener } = await setupWithListener();

      emit({ state: 'visible', windowId: 123 });
      emit({ state: 'hidden', windowId: 123, reason: 'visibility-change' });
      emit({ state: 'hidden', windowId: 123, reason: 'port-disconnected' });

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('should keep notifying on genuine changes', async () => {
      const { emit, listener } = await setupWithListener();

      emit({ state: 'visible', windowId: 123 });
      emit({ state: 'hidden', windowId: 123 });
      emit({ state: 'visible', windowId: 123 });

      expect(listener).toHaveBeenCalledTimes(3);
    });

    it('should notify repeats when includeRepeats is set', async () => {
      const { emit, listener } = await setupWithListener({ includeRepeats: true });

      emit({ state: 'visible', windowId: 123, reason: 'document-load' });
      emit({ state: 'visible', windowId: 123, reason: 'reconnected' });

      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith({
        state: 'visible',
        reason: 'reconnected',
        windowId: 123,
        previousState: 'visible',
      });
    });

    it('should apply the option per listener', async () => {
      const { emit, onSidePanelStateChange } = await setupManager();

      const changesOnly = vi.fn();
      const everything = vi.fn();
      onSidePanelStateChange(changesOnly);
      onSidePanelStateChange(everything, { includeRepeats: true });

      emit({ state: 'visible', windowId: 123 });
      emit({ state: 'visible', windowId: 123, reason: 'reconnected' });

      expect(changesOnly).toHaveBeenCalledTimes(1);
      expect(everything).toHaveBeenCalledTimes(2);
    });

    it('should treat a repeat in another window as a change', async () => {
      const { emit, listener } = await setupWithListener();

      emit({ state: 'visible', windowId: 123 });
      emit({ state: 'visible', windowId: 456 });

      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe('previousState', () => {
    it('should be undefined for the first event of a window', async () => {
      const { emit, listener } = await setupWithListener();

      emit({ state: 'visible', windowId: 123 });

      expect(listener.mock.calls[0]![0]).toMatchObject({ previousState: undefined });
    });

    it('should report the state that was already known', async () => {
      const { emit, listener } = await setupWithListener({ includeRepeats: true });

      emit({ state: 'visible', windowId: 123 });
      emit({ state: 'visible', windowId: 123, reason: 'reconnected' });

      expect(listener.mock.calls[1]![0]).toMatchObject({
        state: 'visible',
        previousState: 'visible',
      });
    });

    it('should survive the hidden state being dropped from the visible map', async () => {
      const { emit, listener, getSidePanelStateForWindow } = await setupWithListener();

      emit({ state: 'visible', windowId: 123 });
      emit({ state: 'hidden', windowId: 123 });

      // The window is gone from the visible map...
      expect(getSidePanelStateForWindow(123)).toBeUndefined();

      // ...but the next event still knows what it was.
      emit({ state: 'visible', windowId: 123 });

      expect(listener.mock.calls[2]![0]).toMatchObject({
        state: 'visible',
        previousState: 'hidden',
      });
    });

    it('should track windows independently', async () => {
      const { emit, listener } = await setupWithListener();

      emit({ state: 'visible', windowId: 123 });
      emit({ state: 'visible', windowId: 456 });
      emit({ state: 'hidden', windowId: 123 });

      expect(listener.mock.calls[1]![0]).toMatchObject({
        windowId: 456,
        previousState: undefined,
      });
      expect(listener.mock.calls[2]![0]).toMatchObject({
        windowId: 123,
        previousState: 'visible',
      });
    });

    it('should not be shifted by heartbeat messages', async () => {
      const { emit, listener } = await setupWithListener();

      emit({ state: 'visible', windowId: 123 });
      emit({ state: 'hidden', windowId: 123, type: 'side-panel-heartbeat' });
      emit({ state: 'hidden', windowId: 123 });

      // The heartbeat notified nobody and left the baseline at 'visible'.
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener.mock.calls[1]![0]).toMatchObject({
        state: 'hidden',
        previousState: 'visible',
      });
    });

    it('should forget a window once it is closed', async () => {
      const { emit, listener } = await setupWithListener();

      emit({ state: 'visible', windowId: 123 });

      const onRemovedCallback =
        mockChrome.windows.onRemoved.addListener.mock.calls[0]![0]!;
      onRemovedCallback(123);

      emit({ state: 'visible', windowId: 123 });

      expect(listener.mock.calls[1]![0]).toMatchObject({ previousState: undefined });
    });
  });

  describe('onSidePanelShown', () => {
    it('should fire when a panel first becomes visible', async () => {
      const { emit, shown } = await setupWithTransitionListeners();

      emit({ state: 'visible', windowId: 123, reason: 'document-load' });

      expect(shown).toHaveBeenCalledTimes(1);
      expect(shown).toHaveBeenCalledWith({
        state: 'visible',
        reason: 'document-load',
        windowId: 123,
        previousState: undefined,
      });
    });

    it('should not fire for a repeat of a state already known to be visible', async () => {
      const { emit, shown } = await setupWithTransitionListeners();

      emit({ state: 'visible', windowId: 123, reason: 'document-load' });
      emit({ state: 'visible', windowId: 123, reason: 'reconnected' });
      emit({ state: 'visible', windowId: 123, reason: 'visibility-change' });

      expect(shown).toHaveBeenCalledTimes(1);
    });

    it('should fire again after the panel comes back from hidden', async () => {
      const { emit, shown } = await setupWithTransitionListeners();

      // Panel open, then another extension's side panel takes over the slot, then
      // the user switches back to ours.
      emit({ state: 'visible', windowId: 123, reason: 'document-load' });
      emit({ state: 'hidden', windowId: 123, reason: 'visibility-change' });
      emit({ state: 'visible', windowId: 123, reason: 'visibility-change' });

      expect(shown).toHaveBeenCalledTimes(2);
      expect(shown).toHaveBeenLastCalledWith({
        state: 'visible',
        reason: 'visibility-change',
        windowId: 123,
        previousState: 'hidden',
      });
    });

    it('should not fire on the first report after a service worker restart', async () => {
      const { emit, shown } = await setupWithTransitionListeners();

      // A restarted worker knows nothing about the window, so the reconnect arrives
      // with no previous state — but the panel document never went away, so nothing
      // was shown.
      emit({ state: 'visible', windowId: 123, reason: 'reconnected' });

      expect(shown).not.toHaveBeenCalled();
    });

    it('should still fire for a real show that follows a restart', async () => {
      const { emit, shown } = await setupWithTransitionListeners();

      emit({ state: 'visible', windowId: 123, reason: 'reconnected' });
      emit({ state: 'hidden', windowId: 123, reason: 'visibility-change' });
      emit({ state: 'visible', windowId: 123, reason: 'visibility-change' });

      expect(shown).toHaveBeenCalledTimes(1);
      expect(shown).toHaveBeenLastCalledWith({
        state: 'visible',
        reason: 'visibility-change',
        windowId: 123,
        previousState: 'hidden',
      });
    });

    it('should not fire on hidden events', async () => {
      const { emit, shown } = await setupWithTransitionListeners();

      emit({ state: 'visible', windowId: 123 });
      shown.mockClear();

      emit({ state: 'hidden', windowId: 123 });

      expect(shown).not.toHaveBeenCalled();
    });

    it('should stop firing after unsubscribe', async () => {
      const { emit, shown, unsubscribeShown } = await setupWithTransitionListeners();

      unsubscribeShown();
      emit({ state: 'visible', windowId: 123 });

      expect(shown).not.toHaveBeenCalled();
    });
  });

  describe('onSidePanelHidden', () => {
    it('should fire when a visible panel goes away', async () => {
      const { emit, hidden } = await setupWithTransitionListeners();

      emit({ state: 'visible', windowId: 123 });
      emit({ state: 'hidden', windowId: 123, reason: 'visibility-change' });

      expect(hidden).toHaveBeenCalledTimes(1);
      expect(hidden).toHaveBeenCalledWith({
        state: 'hidden',
        reason: 'visibility-change',
        windowId: 123,
        previousState: 'visible',
      });
    });

    it('should not fire twice for consecutive hidden reports', async () => {
      const { emit, hidden } = await setupWithTransitionListeners();

      emit({ state: 'visible', windowId: 123 });
      emit({ state: 'hidden', windowId: 123, reason: 'visibility-change' });
      emit({ state: 'hidden', windowId: 123, reason: 'port-disconnected' });

      expect(hidden).toHaveBeenCalledTimes(1);
    });

    it('should not fire for a window that was never seen visible', async () => {
      const { emit, hidden } = await setupWithTransitionListeners();

      emit({ state: 'hidden', windowId: 123, reason: 'port-disconnected' });

      expect(hidden).not.toHaveBeenCalled();
    });

    it('should not fire when a reconnect reports the panel as hidden', async () => {
      const { emit, hidden } = await setupWithTransitionListeners();

      emit({ state: 'visible', windowId: 123 });
      // The worker restarted while the panel document sat hidden behind another
      // extension's panel. The reconnect reports that state, it does not create it.
      emit({ state: 'hidden', windowId: 123, reason: 'reconnected' });

      expect(hidden).not.toHaveBeenCalled();
    });

    it('should not fire on visible events', async () => {
      const { emit, hidden } = await setupWithTransitionListeners();

      emit({ state: 'visible', windowId: 123 });

      expect(hidden).not.toHaveBeenCalled();
    });

    it('should stop firing after unsubscribe', async () => {
      const { emit, hidden, unsubscribeHidden } = await setupWithTransitionListeners();

      emit({ state: 'visible', windowId: 123 });
      unsubscribeHidden();
      emit({ state: 'hidden', windowId: 123 });

      expect(hidden).not.toHaveBeenCalled();
    });
  });
});
