import type { EncryptionProvider } from '../src/chrome-storage';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChromeStorage, createStorageAPI } from '../src/chrome-storage';

// Mock encryption provider
function createMockEncryptionProvider(): EncryptionProvider {
  return {
    encrypt: vi.fn().mockResolvedValue(undefined),
    // Return JSON-serialized string as the real provider would
    decrypt: vi.fn().mockResolvedValue('"decrypted"'),
    remove: vi.fn().mockResolvedValue(undefined),
    has: vi.fn().mockResolvedValue(true),
  };
}

// Mock chrome storage
function createMockChromeStorage() {
  const storageData = new Map<string, unknown>();
  const runtime = {
    lastError: undefined as { message: string } | undefined,
  };

  const onChangedListeners: ((
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => void)[] = [];

  const mockObj = {
    storage: {
      local: {
        get: vi.fn((keys, callback) => {
          if (runtime.lastError) {
            callback({});
            return;
          }
          const result: Record<string, unknown> = {};
          if (keys) {
            const keyArray = Array.isArray(keys) ? keys : [keys];
            keyArray.forEach((key: string) => {
              if (storageData.has(key)) {
                result[key] = storageData.get(key);
              }
            });
          }
          callback(result);
        }),
        set: vi.fn((items, callback) => {
          if (runtime.lastError) {
            callback?.();
            return;
          }
          Object.entries(items).forEach(([key, value]) => {
            storageData.set(key, value);
          });
          callback?.();
        }),
        remove: vi.fn((keys, callback) => {
          if (runtime.lastError) {
            callback?.();
            return;
          }
          const keyArray = Array.isArray(keys) ? keys : [keys];
          keyArray.forEach((key: string) => storageData.delete(key));
          callback?.();
        }),
        clear: vi.fn((callback) => {
          if (runtime.lastError) {
            callback?.();
            return;
          }
          storageData.clear();
          callback?.();
        }),
        getBytesInUse: vi.fn((keys, callback) => {
          if (runtime.lastError) {
            callback(0);
            return;
          }
          callback(0);
        }),
      },
      sync: {
        get: vi.fn((keys, callback) => {
          if (runtime.lastError) {
            callback({});
            return;
          }
          const result: Record<string, unknown> = {};
          if (keys) {
            const keyArray = Array.isArray(keys) ? keys : [keys];
            keyArray.forEach((key: string) => {
              if (storageData.has(key)) {
                result[key] = storageData.get(key);
              }
            });
          }
          callback(result);
        }),
        set: vi.fn((items, callback) => {
          if (runtime.lastError) {
            callback?.();
            return;
          }
          Object.entries(items).forEach(([key, value]) => {
            storageData.set(key, value);
          });
          callback?.();
        }),
        remove: vi.fn((keys, callback) => {
          if (runtime.lastError) {
            callback?.();
            return;
          }
          const keyArray = Array.isArray(keys) ? keys : [keys];
          keyArray.forEach((key: string) => storageData.delete(key));
          callback?.();
        }),
        clear: vi.fn((callback) => {
          if (runtime.lastError) {
            callback?.();
            return;
          }
          storageData.clear();
          callback?.();
        }),
        getBytesInUse: vi.fn((keys, callback) => {
          if (runtime.lastError) {
            callback(0);
            return;
          }
          callback(0);
        }),
      },
    },
    runtime,
    storageData,
  };

  // Add onChanged mock
  (
    mockObj.storage as unknown as { onChanged: chrome.storage.StorageChangedEvent }
  ).onChanged = {
    addListener: vi.fn((callback) => {
      onChangedListeners.push(callback);
    }),
    removeListener: vi.fn((callback) => {
      const index = onChangedListeners.indexOf(callback);
      if (index > -1) {
        onChangedListeners.splice(index, 1);
      }
    }),
    hasListener: vi.fn((callback) => onChangedListeners.includes(callback)),
  } as unknown as chrome.storage.StorageChangedEvent;

  return {
    ...mockObj,
    // Expose onChangedListeners for testing
    triggerStorageChange: (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      onChangedListeners.forEach((listener) => listener(changes, areaName));
    },
  };
}

describe('chromeStorage', () => {
  let mockChrome: ReturnType<typeof createMockChromeStorage>;

  // Generic test schema for tests that need basic storage operations
  interface TestStorageSchema {
    testKey: string | { name: string; value: number };
    secretKey: string;
    key: string;
    removeMe: string;
    existingKey: string;
    key1: string;
    key2: string;
    syncToken: string;
    oneTimeToken: string;
    nonExistent: string;
  }

  beforeEach(() => {
    mockChrome = createMockChromeStorage();
    globalThis.chrome = mockChrome as unknown as typeof chrome;
    // Clear storage between tests
    mockChrome.storageData.clear();
  });

  describe('constructor', () => {
    it('should create instance without encryption provider', () => {
      const manager = new ChromeStorage();
      expect(manager).toBeInstanceOf(ChromeStorage);
    });

    it('should accept custom encryption provider', () => {
      const customProvider = createMockEncryptionProvider();
      const manager = new ChromeStorage({
        encryptionProvider: customProvider,
      });
      expect(manager).toBeInstanceOf(ChromeStorage);
    });

    it('should disable encryption when explicitly set to null', () => {
      const manager = new ChromeStorage({ encryptionProvider: null });
      expect(manager).toBeInstanceOf(ChromeStorage);
    });

    it('should accept custom key transformer', () => {
      const manager = new ChromeStorage({
        keyTransformer: (key) => `prefix_${key}`,
      });
      expect(manager).toBeInstanceOf(ChromeStorage);
    });
  });

  describe('get/set operations', () => {
    it.skip('should store and retrieve plain data', async () => {
      const manager = new ChromeStorage<TestStorageSchema>({ encryptionProvider: null });

      await manager.set('testKey', 'testValue');
      const value = await manager.get('testKey');
      expect(value).toBe('testValue');
    });

    it('should use encryption provider for encrypted operations', async () => {
      const mockProvider = createMockEncryptionProvider();
      const manager = new ChromeStorage<TestStorageSchema>({
        encryptionProvider: mockProvider,
      });

      await manager.set('secretKey', 'secretValue', { encrypted: true });
      // Value should be JSON-serialized before encryption
      expect(mockProvider.encrypt).toHaveBeenCalledWith('secretKey', '"secretValue"');

      await manager.get('secretKey', { encrypted: true });
      expect(mockProvider.decrypt).toHaveBeenCalledWith('secretKey');
    });

    it('should throw error when encryption provider not configured', async () => {
      const manager = new ChromeStorage<TestStorageSchema>({ encryptionProvider: null });

      await expect(manager.set('key', 'value', { encrypted: true })).rejects.toThrow(
        'Encryption provider not configured',
      );
    });
  });

  describe('remove operations', () => {
    it.skip('should remove plain data', async () => {
      const manager = new ChromeStorage<TestStorageSchema>({ encryptionProvider: null });

      await manager.set('removeMe', 'value');
      await manager.remove('removeMe');

      const value = await manager.get('removeMe');
      expect(value).toBeUndefined();
    });

    it('should use encryption provider for encrypted remove', async () => {
      const mockProvider = createMockEncryptionProvider();
      const manager = new ChromeStorage<TestStorageSchema>({
        encryptionProvider: mockProvider,
      });

      await manager.remove('secretKey', { encrypted: true });
      expect(mockProvider.remove).toHaveBeenCalledWith('secretKey');
    });
  });

  describe('has operation', () => {
    it.skip('should check existence of plain data', async () => {
      const manager = new ChromeStorage<TestStorageSchema>({ encryptionProvider: null });

      await manager.set('existingKey', 'value');
      const exists = await manager.has('existingKey');
      expect(exists).toBe(true);
    });

    it('should use encryption provider for encrypted has', async () => {
      const mockProvider = createMockEncryptionProvider();
      const manager = new ChromeStorage<TestStorageSchema>({
        encryptionProvider: mockProvider,
      });

      await manager.has('secretKey', { encrypted: true });
      expect(mockProvider.has).toHaveBeenCalledWith('secretKey');
    });
  });

  describe('keyTransformer consistency', () => {
    it('should apply keyTransformer to encrypted get operations', async () => {
      const mockProvider = createMockEncryptionProvider();
      const manager = new ChromeStorage<TestStorageSchema>({
        keyTransformer: (key) => `dev_${key}`,
        encryptionProvider: mockProvider,
      });

      await manager.get('testKey', { encrypted: true });
      expect(mockProvider.decrypt).toHaveBeenCalledWith('dev_testKey');
    });

    it('should apply keyTransformer to encrypted set operations', async () => {
      const mockProvider = createMockEncryptionProvider();
      const manager = new ChromeStorage<TestStorageSchema>({
        keyTransformer: (key) => `dev_${key}`,
        encryptionProvider: mockProvider,
      });

      await manager.set('testKey', 'testValue', { encrypted: true });
      expect(mockProvider.encrypt).toHaveBeenCalledWith('dev_testKey', '"testValue"');
    });

    it('should apply keyTransformer to encrypted remove operations', async () => {
      const mockProvider = createMockEncryptionProvider();
      const manager = new ChromeStorage<TestStorageSchema>({
        keyTransformer: (key) => `dev_${key}`,
        encryptionProvider: mockProvider,
      });

      await manager.remove('testKey', { encrypted: true });
      expect(mockProvider.remove).toHaveBeenCalledWith('dev_testKey');
    });

    it('should apply keyTransformer to encrypted has operations', async () => {
      const mockProvider = createMockEncryptionProvider();
      const manager = new ChromeStorage<TestStorageSchema>({
        keyTransformer: (key) => `dev_${key}`,
        encryptionProvider: mockProvider,
      });

      await manager.has('testKey', { encrypted: true });
      expect(mockProvider.has).toHaveBeenCalledWith('dev_testKey');
    });

    it('should apply keyTransformer to encrypted remove with multiple keys', async () => {
      const mockProvider = createMockEncryptionProvider();
      const manager = new ChromeStorage<TestStorageSchema>({
        keyTransformer: (key) => `dev_${key}`,
        encryptionProvider: mockProvider,
      });

      await manager.remove(['key1', 'key2'], { encrypted: true });
      expect(mockProvider.remove).toHaveBeenCalledWith('dev_key1');
      expect(mockProvider.remove).toHaveBeenCalledWith('dev_key2');
    });
  });

  describe('error context in messages', () => {
    it('should include storage area and operation in get error messages', async () => {
      mockChrome.runtime.lastError = { message: 'Storage quota exceeded' };
      const manager = new ChromeStorage<TestStorageSchema>({ encryptionProvider: null });

      await expect(manager.get('key')).rejects.toThrow(
        'chrome.storage.local.get failed: Storage quota exceeded',
      );

      mockChrome.runtime.lastError = undefined;
    });

    it('should include storage area and operation in set error messages', async () => {
      mockChrome.runtime.lastError = { message: 'Storage quota exceeded' };
      const manager = new ChromeStorage<TestStorageSchema>({ encryptionProvider: null });

      await expect(manager.set('key', 'value')).rejects.toThrow(
        'chrome.storage.local.set failed: Storage quota exceeded',
      );

      mockChrome.runtime.lastError = undefined;
    });

    it('should include storage area and operation in remove error messages', async () => {
      mockChrome.runtime.lastError = { message: 'Operation failed' };
      const manager = new ChromeStorage<TestStorageSchema>({ encryptionProvider: null });

      await expect(manager.remove('key')).rejects.toThrow(
        'chrome.storage.local.remove failed: Operation failed',
      );

      mockChrome.runtime.lastError = undefined;
    });

    it('should include storage area and operation in clear error messages', async () => {
      mockChrome.runtime.lastError = { message: 'Operation failed' };
      const manager = new ChromeStorage({ encryptionProvider: null });

      await expect(manager.clear()).rejects.toThrow(
        'chrome.storage.local.clear failed: Operation failed',
      );

      mockChrome.runtime.lastError = undefined;
    });

    it('should include storage area and operation in getBytesInUse error messages', async () => {
      mockChrome.runtime.lastError = { message: 'Operation failed' };
      const manager = new ChromeStorage({ encryptionProvider: null });

      await expect(manager.getBytesInUse()).rejects.toThrow(
        'chrome.storage.local.getBytesInUse failed: Operation failed',
      );

      mockChrome.runtime.lastError = undefined;
    });
  });

  describe('safe JSON parsing', () => {
    it('should handle corrupted JSON gracefully in get operations', async () => {
      const mockProvider = createMockEncryptionProvider();
      // Mock decrypt to return invalid JSON
      vi.mocked(mockProvider.decrypt).mockResolvedValue('invalid{json');

      const manager = new ChromeStorage<TestStorageSchema>({
        encryptionProvider: mockProvider,
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await manager.get('testKey', { encrypted: true });

      expect(result).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse decrypted data for key: testKey',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it('should handle valid JSON correctly', async () => {
      interface ComplexSchema {
        testKey: { name: string; value: number };
      }

      const mockProvider = createMockEncryptionProvider();
      // Mock decrypt to return valid JSON
      vi.mocked(mockProvider.decrypt).mockResolvedValue('{"name":"test","value":123}');

      const manager = new ChromeStorage<ComplexSchema>({
        encryptionProvider: mockProvider,
      });

      const result = await manager.get('testKey', {
        encrypted: true,
      });

      expect(result).toEqual({ name: 'test', value: 123 });
    });

    it('should not warn on successful parse', async () => {
      const mockProvider = createMockEncryptionProvider();
      vi.mocked(mockProvider.decrypt).mockResolvedValue('"validString"');

      const manager = new ChromeStorage<TestStorageSchema>({
        encryptionProvider: mockProvider,
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await manager.get('testKey', { encrypted: true });

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('generic type support', () => {
    interface TestSchema {
      username: string;
      count: number;
      settings: { theme: string; notifications: boolean };
    }

    it('should provide type-safe get and set operations', async () => {
      const manager = new ChromeStorage<TestSchema>({ encryptionProvider: null });

      // Type-safe set
      await manager.set('username', 'john_doe');
      await manager.set('count', 42);
      await manager.set('settings', { theme: 'dark', notifications: true });

      // Type-safe get
      const username = await manager.get('username');
      const count = await manager.get('count');
      const settings = await manager.get('settings');

      expect(username).toBe('john_doe');
      expect(count).toBe(42);
      expect(settings).toEqual({ theme: 'dark', notifications: true });
    });

    it('should work with has method', async () => {
      const manager = new ChromeStorage<TestSchema>({ encryptionProvider: null });

      await manager.set('username', 'test');
      const exists = await manager.has('username');

      expect(exists).toBe(true);
    });

    it('should work with remove method', async () => {
      const manager = new ChromeStorage<TestSchema>({ encryptionProvider: null });

      await manager.set('username', 'test');
      await manager.remove('username');

      const value = await manager.get('username');
      expect(value).toBeUndefined();
    });

    it('should work with getBytesInUse method', async () => {
      const manager = new ChromeStorage<TestSchema>({ encryptionProvider: null });

      await manager.set('username', 'test');
      const bytes = await manager.getBytesInUse('username');

      expect(bytes).toBe(0); // Mock returns 0
    });

    it('should enforce schema keys at compile time', async () => {
      const manager = new ChromeStorage<TestSchema>({ encryptionProvider: null });

      // These would cause TypeScript errors if uncommented:
      // await manager.set('invalidKey', 'value'); // TS Error
      // await manager.get('invalidKey'); // TS Error
      // await manager.remove('invalidKey'); // TS Error
      // await manager.set('count', 'not-a-number'); // TS Error: Type 'string' is not assignable to type 'number'
      // await manager.set('username', 123); // TS Error: Type 'number' is not assignable to type 'string'

      // Valid operations
      await manager.set('username', 'valid');
      const value = await manager.get('username');
      expect(value).toBe('valid');
    });

    it('should show TypeScript error for invalid keys in getMultiple', async () => {
      const manager = new ChromeStorage<TestSchema>({ encryptionProvider: null });

      // This would cause TypeScript error if uncommented:
      // await manager.getMultiple(['username', 'invalidKey']); // TS Error

      // Valid operation
      const result = await manager.getMultiple(['username', 'count']);
      expect(result).toBeDefined();
    });

    it('should show TypeScript error for invalid keys in setMultiple', async () => {
      const manager = new ChromeStorage<TestSchema>({ encryptionProvider: null });

      // These would cause TypeScript errors if uncommented:
      // await manager.setMultiple({ invalidKey: 'value' }); // TS Error
      // await manager.setMultiple({ count: 'not-a-number' }); // TS Error

      // Valid operation
      await manager.setMultiple({ username: 'test', count: 10 });
      const username = await manager.get('username');
      expect(username).toBe('test');
    });
  });

  describe('getOnce', () => {
    it('should get value and remove it from storage', async () => {
      const manager = new ChromeStorage<TestStorageSchema>({ encryptionProvider: null });

      // Set a value
      await manager.set('oneTimeToken', 'token123');

      // Get it once
      const value = await manager.getOnce('oneTimeToken');
      expect(value).toBe('token123');

      // Verify it was removed
      const valueAfter = await manager.get('oneTimeToken');
      expect(valueAfter).toBeUndefined();
    });

    it('should return undefined for non-existent keys', async () => {
      const manager = new ChromeStorage<TestStorageSchema>({ encryptionProvider: null });

      const value = await manager.getOnce('nonExistent');
      expect(value).toBeUndefined();
    });

    it('should not call remove if value does not exist', async () => {
      const manager = new ChromeStorage<TestStorageSchema>({ encryptionProvider: null });

      // Spy on remove method
      const removeSpy = vi.spyOn(manager, 'remove');

      await manager.getOnce('nonExistent');

      expect(removeSpy).not.toHaveBeenCalled();

      removeSpy.mockRestore();
    });

    it('should work with typed schema', async () => {
      interface TestSchema {
        oneTimeCode: string;
        tempData: { value: number };
      }

      const manager = new ChromeStorage<TestSchema>({ encryptionProvider: null });

      await manager.set('oneTimeCode', 'CODE123');
      const code = await manager.getOnce('oneTimeCode');

      expect(code).toBe('CODE123');

      const codeAfter = await manager.get('oneTimeCode');
      expect(codeAfter).toBeUndefined();
    });

    it('should work with encrypted data', async () => {
      interface SecretSchema {
        secretToken: string;
      }

      const mockProvider = createMockEncryptionProvider();
      const manager = new ChromeStorage<SecretSchema>({
        encryptionProvider: mockProvider,
      });

      await manager.set('secretToken', 'secret123', { encrypted: true });
      const value = await manager.getOnce('secretToken', { encrypted: true });

      expect(value).toBe('decrypted');
      expect(mockProvider.decrypt).toHaveBeenCalledWith('secretToken');
      expect(mockProvider.remove).toHaveBeenCalledWith('secretToken');
    });

    it('should work with sync storage', async () => {
      const manager = new ChromeStorage<TestStorageSchema>({ encryptionProvider: null });

      await manager.set('syncToken', 'token456', { area: 'sync' });
      const value = await manager.getOnce('syncToken', { area: 'sync' });

      expect(value).toBe('token456');

      const valueAfter = await manager.get('syncToken', { area: 'sync' });
      expect(valueAfter).toBeUndefined();
    });

    it('should work with complex objects', async () => {
      interface TempSchema {
        tempSession: {
          userId: number;
          sessionId: string;
          permissions: string[];
        };
      }

      const manager = new ChromeStorage<TempSchema>({ encryptionProvider: null });

      const tempData = {
        userId: 123,
        sessionId: 'abc-def',
        permissions: ['read', 'write'],
      };

      await manager.set('tempSession', tempData);
      const session = await manager.getOnce('tempSession');

      expect(session).toEqual(tempData);

      const sessionAfter = await manager.get('tempSession');
      expect(sessionAfter).toBeUndefined();
    });

    it('should throw error when encryption provider not configured', async () => {
      interface TestSchema {
        key: string;
      }

      const manager = new ChromeStorage<TestSchema>({ encryptionProvider: null });

      await expect(manager.getOnce('key', { encrypted: true })).rejects.toThrow(
        'Encryption provider not configured',
      );
    });
  });

  describe('watch', () => {
    it('should listen to changes for a specific key', async () => {
      interface TestSchema {
        username: string;
        email: string;
      }

      const manager = new ChromeStorage<TestSchema>();
      const callback = vi.fn();

      const unsubscribe = manager.watch('username', callback);

      // Simulate a storage change event
      mockChrome.triggerStorageChange(
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

      unsubscribe();
    });

    it('should not trigger callback for other keys', async () => {
      interface TestSchema {
        username: string;
        email: string;
      }

      const manager = new ChromeStorage<TestSchema>();
      const callback = vi.fn();

      manager.watch('username', callback);

      // Simulate a storage change event for a different key
      mockChrome.triggerStorageChange(
        {
          email: { oldValue: 'old@email.com', newValue: 'new@email.com' },
        },
        'local',
      );

      expect(callback).not.toHaveBeenCalled();
    });

    it('should filter by storage area when specified', async () => {
      interface TestSchema {
        username: string;
      }

      const manager = new ChromeStorage<TestSchema>();
      const callback = vi.fn();

      manager.watch('username', callback, { area: 'local' });

      // Trigger change in sync storage (should be ignored)
      mockChrome.triggerStorageChange(
        {
          username: { oldValue: 'old', newValue: 'new' },
        },
        'sync',
      );

      expect(callback).not.toHaveBeenCalled();

      // Trigger change in local storage (should be called)
      mockChrome.triggerStorageChange(
        {
          username: { oldValue: 'old', newValue: 'new' },
        },
        'local',
      );

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should support multiple listeners for the same key', async () => {
      interface TestSchema {
        username: string;
      }

      const manager = new ChromeStorage<TestSchema>();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      manager.watch('username', callback1);
      manager.watch('username', callback2);

      mockChrome.triggerStorageChange(
        {
          username: { oldValue: 'old', newValue: 'new' },
        },
        'local',
      );

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should stop listening when unsubscribe is called', async () => {
      interface TestSchema {
        username: string;
      }

      const manager = new ChromeStorage<TestSchema>();
      const callback = vi.fn();

      const unsubscribe = manager.watch('username', callback);

      // First change - should trigger callback
      mockChrome.triggerStorageChange(
        {
          username: { oldValue: 'old', newValue: 'new' },
        },
        'local',
      );

      expect(callback).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Second change - should NOT trigger callback
      mockChrome.triggerStorageChange(
        {
          username: { oldValue: 'new', newValue: 'newer' },
        },
        'local',
      );

      expect(callback).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should work with key transformer', async () => {
      interface TestSchema {
        username: string;
      }

      const manager = new ChromeStorage<TestSchema>({
        keyTransformer: (key) => `myapp_${key}`,
      });
      const callback = vi.fn();

      manager.watch('username', callback);

      // Should listen to the transformed key
      mockChrome.triggerStorageChange(
        {
          myapp_username: { oldValue: 'old', newValue: 'new' },
        },
        'local',
      );

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        { oldValue: 'old', newValue: 'new' },
        'myapp_username',
        'local',
      );
    });

    it('should handle changes with undefined oldValue (new item)', async () => {
      interface TestSchema {
        username: string;
      }

      const manager = new ChromeStorage<TestSchema>();
      const callback = vi.fn();

      manager.watch('username', callback);

      mockChrome.triggerStorageChange(
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

    it('should handle changes with undefined newValue (deleted item)', async () => {
      interface TestSchema {
        username: string;
      }

      const manager = new ChromeStorage<TestSchema>();
      const callback = vi.fn();

      manager.watch('username', callback);

      mockChrome.triggerStorageChange(
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
  });
});
