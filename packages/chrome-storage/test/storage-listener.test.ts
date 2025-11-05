import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StorageListener } from '../src/storage-listener';

// Mock chrome.storage.onChanged
function createMockChromeStorageOnChanged() {
  const listeners: ((
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => void)[] = [];

  return {
    onChanged: {
      addListener: vi.fn((callback) => {
        listeners.push(callback);
      }),
      removeListener: vi.fn((callback) => {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }),
      hasListener: vi.fn((callback) => listeners.includes(callback)),
    },
    triggerChange: (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      listeners.forEach((listener) => listener(changes, areaName));
    },
    getListenerCount: () => listeners.length,
  };
}

describe('storageListener', () => {
  let mockChrome: ReturnType<typeof createMockChromeStorageOnChanged>;

  beforeEach(() => {
    mockChrome = createMockChromeStorageOnChanged();
    globalThis.chrome = {
      storage: {
        onChanged: mockChrome.onChanged,
      },
    } as unknown as typeof chrome;
  });

  describe('addListener', () => {
    it('should add a listener for a specific key', () => {
      const listener = new StorageListener();
      const callback = vi.fn();

      const unsubscribe = listener.addListener('username', callback);

      expect(unsubscribe).toBeTypeOf('function');
      expect(listener.listenerCount).toBe(1);
    });

    it('should initialize chrome listener on first listener', () => {
      const listener = new StorageListener();
      const callback = vi.fn();

      expect(mockChrome.onChanged.addListener).not.toHaveBeenCalled();

      listener.addListener('username', callback);

      expect(mockChrome.onChanged.addListener).toHaveBeenCalledTimes(1);
    });

    it('should not initialize chrome listener again for subsequent listeners', () => {
      const listener = new StorageListener();

      listener.addListener('username', vi.fn());
      listener.addListener('email', vi.fn());

      expect(mockChrome.onChanged.addListener).toHaveBeenCalledTimes(1);
    });

    it('should trigger callback when key changes', () => {
      const listener = new StorageListener();
      const callback = vi.fn();

      listener.addListener('username', callback);

      mockChrome.triggerChange(
        {
          username: { oldValue: 'old', newValue: 'new' },
        },
        'local',
      );

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        { oldValue: 'old', newValue: 'new' },
        'username',
        'local',
      );
    });

    it('should not trigger callback for different keys', () => {
      const listener = new StorageListener();
      const callback = vi.fn();

      listener.addListener('username', callback);

      mockChrome.triggerChange(
        {
          email: { oldValue: 'old@email.com', newValue: 'new@email.com' },
        },
        'local',
      );

      expect(callback).not.toHaveBeenCalled();
    });

    it('should filter by area when specified', () => {
      const listener = new StorageListener();
      const callback = vi.fn();

      listener.addListener('username', callback, 'local');

      // Change in sync storage - should be ignored
      mockChrome.triggerChange(
        {
          username: { oldValue: 'old', newValue: 'new' },
        },
        'sync',
      );

      expect(callback).not.toHaveBeenCalled();

      // Change in local storage - should trigger
      mockChrome.triggerChange(
        {
          username: { oldValue: 'old', newValue: 'new' },
        },
        'local',
      );

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should listen to both areas when area not specified', () => {
      const listener = new StorageListener();
      const callback = vi.fn();

      listener.addListener('username', callback);

      // Change in local storage
      mockChrome.triggerChange(
        {
          username: { oldValue: 'old1', newValue: 'new1' },
        },
        'local',
      );

      // Change in sync storage
      mockChrome.triggerChange(
        {
          username: { oldValue: 'old2', newValue: 'new2' },
        },
        'sync',
      );

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should support multiple listeners for the same key', () => {
      const listener = new StorageListener();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      listener.addListener('username', callback1);
      listener.addListener('username', callback2);

      mockChrome.triggerChange(
        {
          username: { oldValue: 'old', newValue: 'new' },
        },
        'local',
      );

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should handle callback errors gracefully', () => {
      const listener = new StorageListener();
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      listener.addListener('username', errorCallback);
      listener.addListener('username', normalCallback);

      mockChrome.triggerChange(
        {
          username: { oldValue: 'old', newValue: 'new' },
        },
        'local',
      );

      expect(errorCallback).toHaveBeenCalledTimes(1);
      expect(normalCallback).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('unsubscribe', () => {
    it('should remove listener when unsubscribe is called', () => {
      const listener = new StorageListener();
      const callback = vi.fn();

      const unsubscribe = listener.addListener('username', callback);

      expect(listener.listenerCount).toBe(1);

      unsubscribe();

      expect(listener.listenerCount).toBe(0);
    });

    it('should stop triggering callback after unsubscribe', () => {
      const listener = new StorageListener();
      const callback = vi.fn();

      const unsubscribe = listener.addListener('username', callback);

      mockChrome.triggerChange(
        {
          username: { oldValue: 'old', newValue: 'new' },
        },
        'local',
      );

      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      mockChrome.triggerChange(
        {
          username: { oldValue: 'new', newValue: 'newer' },
        },
        'local',
      );

      expect(callback).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should cleanup chrome listener when last listener is removed', () => {
      const listener = new StorageListener();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const unsubscribe1 = listener.addListener('username', callback1);
      const unsubscribe2 = listener.addListener('email', callback2);

      expect(mockChrome.getListenerCount()).toBe(1);

      unsubscribe1();
      expect(mockChrome.getListenerCount()).toBe(1); // Still has one listener

      unsubscribe2();
      expect(mockChrome.getListenerCount()).toBe(0); // Chrome listener removed
    });

    it('should be safe to call unsubscribe multiple times', () => {
      const listener = new StorageListener();
      const callback = vi.fn();

      const unsubscribe = listener.addListener('username', callback);

      unsubscribe();
      unsubscribe(); // Should not throw

      expect(listener.listenerCount).toBe(0);
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all listeners', () => {
      const listener = new StorageListener();

      listener.addListener('username', vi.fn());
      listener.addListener('email', vi.fn());
      listener.addListener('theme', vi.fn());

      expect(listener.listenerCount).toBe(3);

      listener.removeAllListeners();

      expect(listener.listenerCount).toBe(0);
    });

    it('should cleanup chrome listener', () => {
      const listener = new StorageListener();

      listener.addListener('username', vi.fn());
      listener.addListener('email', vi.fn());

      expect(mockChrome.getListenerCount()).toBe(1);

      listener.removeAllListeners();

      expect(mockChrome.getListenerCount()).toBe(0);
    });

    it('should not trigger callbacks after removeAllListeners', () => {
      const listener = new StorageListener();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      listener.addListener('username', callback1);
      listener.addListener('email', callback2);

      listener.removeAllListeners();

      mockChrome.triggerChange(
        {
          username: { oldValue: 'old', newValue: 'new' },
          email: { oldValue: 'old@email.com', newValue: 'new@email.com' },
        },
        'local',
      );

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('listenerCount', () => {
    it('should return 0 initially', () => {
      const listener = new StorageListener();
      expect(listener.listenerCount).toBe(0);
    });

    it('should increment with each listener added', () => {
      const listener = new StorageListener();

      listener.addListener('username', vi.fn());
      expect(listener.listenerCount).toBe(1);

      listener.addListener('email', vi.fn());
      expect(listener.listenerCount).toBe(2);

      listener.addListener('theme', vi.fn());
      expect(listener.listenerCount).toBe(3);
    });

    it('should decrement when listeners are removed', () => {
      const listener = new StorageListener();

      const unsubscribe1 = listener.addListener('username', vi.fn());
      const unsubscribe2 = listener.addListener('email', vi.fn());

      expect(listener.listenerCount).toBe(2);

      unsubscribe1();
      expect(listener.listenerCount).toBe(1);

      unsubscribe2();
      expect(listener.listenerCount).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle changes with undefined oldValue', () => {
      const listener = new StorageListener();
      const callback = vi.fn();

      listener.addListener('username', callback);

      mockChrome.triggerChange(
        {
          username: { newValue: 'new' },
        },
        'local',
      );

      expect(callback).toHaveBeenCalledWith(
        { oldValue: undefined, newValue: 'new' },
        'username',
        'local',
      );
    });

    it('should handle changes with undefined newValue', () => {
      const listener = new StorageListener();
      const callback = vi.fn();

      listener.addListener('username', callback);

      mockChrome.triggerChange(
        {
          username: { oldValue: 'old' },
        },
        'local',
      );

      expect(callback).toHaveBeenCalledWith(
        { oldValue: 'old', newValue: undefined },
        'username',
        'local',
      );
    });

    it('should handle multiple changes in one event', () => {
      const listener = new StorageListener();
      const usernameCallback = vi.fn();
      const emailCallback = vi.fn();

      listener.addListener('username', usernameCallback);
      listener.addListener('email', emailCallback);

      mockChrome.triggerChange(
        {
          username: { oldValue: 'old_user', newValue: 'new_user' },
          email: { oldValue: 'old@email.com', newValue: 'new@email.com' },
          theme: { oldValue: 'dark', newValue: 'light' }, // Not listened to
        },
        'local',
      );

      expect(usernameCallback).toHaveBeenCalledTimes(1);
      expect(emailCallback).toHaveBeenCalledTimes(1);
    });
  });
});
