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
    it('should log error when not initialized', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { getSidePanelStateForWindow } = await import(
        '../src/sidepanel-state-manager'
      );
      getSidePanelStateForWindow(123);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Side panel state manager is not initialized.',
        'Call initSidePanelStateManager() at the top of your background script before using any other functions.',
      );
      consoleErrorSpy.mockRestore();
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
    it('should log error when not initialized', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { isWindowSidePanelVisible } = await import('../src/sidepanel-state-manager');
      isWindowSidePanelVisible(123);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Side panel state manager is not initialized.',
        'Call initSidePanelStateManager() at the top of your background script before using any other functions.',
      );
      consoleErrorSpy.mockRestore();
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
    it('should log error when not initialized', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { onSidePanelStateChange } = await import('../src/sidepanel-state-manager');
      const listener = vi.fn();
      onSidePanelStateChange(listener);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Side panel state manager is not initialized.',
        'Call initSidePanelStateManager() at the top of your background script before using any other functions.',
      );
      consoleErrorSpy.mockRestore();
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
      });
      expect(listener2).toHaveBeenCalledWith({
        state: 'visible',
        reason: 'test',
        windowId: 123,
      });
      expect(listener3).toHaveBeenCalledWith({
        state: 'visible',
        reason: 'test',
        windowId: 123,
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
      });
    });
  });
});
