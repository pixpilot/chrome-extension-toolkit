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
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
        getBytesInUse: vi.fn(),
      },
    },
    runtime,
    storageData,
  };

  return mockObj;
}

describe('chromeStorage', () => {
  let mockChrome: ReturnType<typeof createMockChromeStorage>;

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
      const manager = new ChromeStorage({ encryptionProvider: null });

      await manager.set('testKey', 'testValue');
      const value = await manager.get('testKey');
      expect(value).toBe('testValue');
    });

    it('should use encryption provider for encrypted operations', async () => {
      const mockProvider = createMockEncryptionProvider();
      const manager = new ChromeStorage({
        encryptionProvider: mockProvider,
      });

      await manager.set('secretKey', 'secretValue', { encrypted: true });
      // Value should be JSON-serialized before encryption
      expect(mockProvider.encrypt).toHaveBeenCalledWith('secretKey', '"secretValue"');

      await manager.get('secretKey', { encrypted: true });
      expect(mockProvider.decrypt).toHaveBeenCalledWith('secretKey');
    });

    it('should throw error when encryption provider not configured', async () => {
      const manager = new ChromeStorage({ encryptionProvider: null });

      await expect(manager.set('key', 'value', { encrypted: true })).rejects.toThrow(
        'Encryption provider not configured',
      );
    });
  });

  describe('remove operations', () => {
    it.skip('should remove plain data', async () => {
      const manager = new ChromeStorage({ encryptionProvider: null });

      await manager.set('removeMe', 'value');
      await manager.remove('removeMe');

      const value = await manager.get('removeMe');
      expect(value).toBeUndefined();
    });

    it('should use encryption provider for encrypted remove', async () => {
      const mockProvider = createMockEncryptionProvider();
      const manager = new ChromeStorage({
        encryptionProvider: mockProvider,
      });

      await manager.remove('secretKey', { encrypted: true });
      expect(mockProvider.remove).toHaveBeenCalledWith('secretKey');
    });
  });

  describe('has operation', () => {
    it.skip('should check existence of plain data', async () => {
      const manager = new ChromeStorage({ encryptionProvider: null });

      await manager.set('existingKey', 'value');
      const exists = await manager.has('existingKey');
      expect(exists).toBe(true);
    });

    it('should use encryption provider for encrypted has', async () => {
      const mockProvider = createMockEncryptionProvider();
      const manager = new ChromeStorage({
        encryptionProvider: mockProvider,
      });

      await manager.has('secretKey', { encrypted: true });
      expect(mockProvider.has).toHaveBeenCalledWith('secretKey');
    });
  });

  describe('createStorageAPI', () => {
    it('should create convenience API', () => {
      const manager = new ChromeStorage();
      const api = createStorageAPI(manager);

      expect(api.get).toBeDefined();
      expect(api.set).toBeDefined();
      expect(api.remove).toBeDefined();
      expect(api.has).toBeDefined();
      expect(api.clear).toBeDefined();
      expect(api.getAll).toBeDefined();
      expect(api.getMultiple).toBeDefined();
      expect(api.setMultiple).toBeDefined();
      expect(api.getBytesInUse).toBeDefined();
    });
  });

  describe('keyTransformer consistency', () => {
    it('should apply keyTransformer to encrypted get operations', async () => {
      const mockProvider = createMockEncryptionProvider();
      const manager = new ChromeStorage({
        keyTransformer: (key) => `dev_${key}`,
        encryptionProvider: mockProvider,
      });

      await manager.get('testKey', { encrypted: true });
      expect(mockProvider.decrypt).toHaveBeenCalledWith('dev_testKey');
    });

    it('should apply keyTransformer to encrypted set operations', async () => {
      const mockProvider = createMockEncryptionProvider();
      const manager = new ChromeStorage({
        keyTransformer: (key) => `dev_${key}`,
        encryptionProvider: mockProvider,
      });

      await manager.set('testKey', 'testValue', { encrypted: true });
      expect(mockProvider.encrypt).toHaveBeenCalledWith('dev_testKey', '"testValue"');
    });

    it('should apply keyTransformer to encrypted remove operations', async () => {
      const mockProvider = createMockEncryptionProvider();
      const manager = new ChromeStorage({
        keyTransformer: (key) => `dev_${key}`,
        encryptionProvider: mockProvider,
      });

      await manager.remove('testKey', { encrypted: true });
      expect(mockProvider.remove).toHaveBeenCalledWith('dev_testKey');
    });

    it('should apply keyTransformer to encrypted has operations', async () => {
      const mockProvider = createMockEncryptionProvider();
      const manager = new ChromeStorage({
        keyTransformer: (key) => `dev_${key}`,
        encryptionProvider: mockProvider,
      });

      await manager.has('testKey', { encrypted: true });
      expect(mockProvider.has).toHaveBeenCalledWith('dev_testKey');
    });

    it('should apply keyTransformer to encrypted remove with multiple keys', async () => {
      const mockProvider = createMockEncryptionProvider();
      const manager = new ChromeStorage({
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
      const manager = new ChromeStorage({ encryptionProvider: null });

      await expect(manager.get('key')).rejects.toThrow(
        'chrome.storage.local.get failed: Storage quota exceeded',
      );

      mockChrome.runtime.lastError = undefined;
    });

    it('should include storage area and operation in set error messages', async () => {
      mockChrome.runtime.lastError = { message: 'Storage quota exceeded' };
      const manager = new ChromeStorage({ encryptionProvider: null });

      await expect(manager.set('key', 'value')).rejects.toThrow(
        'chrome.storage.local.set failed: Storage quota exceeded',
      );

      mockChrome.runtime.lastError = undefined;
    });

    it('should include storage area and operation in remove error messages', async () => {
      mockChrome.runtime.lastError = { message: 'Operation failed' };
      const manager = new ChromeStorage({ encryptionProvider: null });

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

      const manager = new ChromeStorage({
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
      const mockProvider = createMockEncryptionProvider();
      // Mock decrypt to return valid JSON
      vi.mocked(mockProvider.decrypt).mockResolvedValue('{"name":"test","value":123}');

      const manager = new ChromeStorage({
        encryptionProvider: mockProvider,
      });

      const result = await manager.get<{ name: string; value: number }>('testKey', {
        encrypted: true,
      });

      expect(result).toEqual({ name: 'test', value: 123 });
    });

    it('should not warn on successful parse', async () => {
      const mockProvider = createMockEncryptionProvider();
      vi.mocked(mockProvider.decrypt).mockResolvedValue('"validString"');

      const manager = new ChromeStorage({
        encryptionProvider: mockProvider,
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await manager.get('testKey', { encrypted: true });

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
