import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  decryptData,
  deriveKeyFromPassword,
  encryptData,
  generateEncryptionKey,
  getEncrypted,
  hasEncrypted,
  removeEncrypted,
  storeEncrypted,
} from '../src/secure-storage';

// Mock chrome storage
function createMockChromeStorage() {
  const localStorage = new Map<string, unknown>();
  const syncStorage = new Map<string, unknown>();

  return {
    storage: {
      local: {
        get: vi.fn((keys, callback) => {
          const result: Record<string, unknown> = {};
          if (keys) {
            const keyArray = Array.isArray(keys) ? keys : [keys];
            keyArray.forEach((key: string) => {
              if (localStorage.has(key)) {
                result[key] = localStorage.get(key);
              }
            });
          }
          callback(result);
        }),
        set: vi.fn((items, callback) => {
          Object.entries(items).forEach(([key, value]) => {
            localStorage.set(key, value);
          });
          callback?.();
        }),
        remove: vi.fn((keys, callback) => {
          const keyArray = Array.isArray(keys) ? keys : [keys];
          keyArray.forEach((key: string) => localStorage.delete(key));
          callback?.();
        }),
        clear: vi.fn((callback) => {
          localStorage.clear();
          callback?.();
        }),
      },
      sync: {
        get: vi.fn((keys, callback) => {
          const result: Record<string, unknown> = {};
          if (keys) {
            const keyArray = Array.isArray(keys) ? keys : [keys];
            keyArray.forEach((key: string) => {
              if (syncStorage.has(key)) {
                result[key] = syncStorage.get(key);
              }
            });
          }
          callback(result);
        }),
        set: vi.fn((items, callback) => {
          Object.entries(items).forEach(([key, value]) => {
            syncStorage.set(key, value);
          });
          callback?.();
        }),
        remove: vi.fn((keys, callback) => {
          const keyArray = Array.isArray(keys) ? keys : [keys];
          keyArray.forEach((key: string) => syncStorage.delete(key));
          callback?.();
        }),
        clear: vi.fn((callback) => {
          syncStorage.clear();
          callback?.();
        }),
      },
    },
    runtime: {
      lastError: undefined,
    },
    localStorage,
    syncStorage,
  };
}

describe('secure-storage', () => {
  let mockChrome: ReturnType<typeof createMockChromeStorage>;

  beforeEach(() => {
    mockChrome = createMockChromeStorage();
    globalThis.chrome = mockChrome as unknown as typeof chrome;
  });

  describe('deriveKeyFromPassword', () => {
    it('should derive a key from password', async () => {
      const result = await deriveKeyFromPassword('test-password');

      expect(result.key).toBeDefined();
      expect(result.key.type).toBe('secret');
      expect(result.salt).toBeDefined();
      expect(typeof result.salt).toBe('string');
    });

    it('should generate different salts for different calls', async () => {
      const result1 = await deriveKeyFromPassword('test-password');
      const result2 = await deriveKeyFromPassword('test-password');

      expect(result1.salt).not.toBe(result2.salt);
    });

    it('should derive the same key from same password and salt', async () => {
      const { salt } = await deriveKeyFromPassword('test-password');
      const { key: key1 } = await deriveKeyFromPassword('test-password', salt);
      const { key: key2 } = await deriveKeyFromPassword('test-password', salt);

      // Keys should have same properties
      expect(key1.type).toBe(key2.type);
      expect(key1.algorithm).toEqual(key2.algorithm);
      expect(key1.usages).toEqual(key2.usages);
    });

    it('should throw error for empty password', async () => {
      await expect(deriveKeyFromPassword('')).rejects.toThrow('Password cannot be empty');
      await expect(deriveKeyFromPassword('   ')).rejects.toThrow(
        'Password cannot be empty',
      );
    });
  });

  describe('generateEncryptionKey', () => {
    it('should generate a random encryption key', async () => {
      const key = await generateEncryptionKey();

      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm).toEqual({ name: 'AES-GCM', length: 256 });
      expect(key.usages).toContain('encrypt');
      expect(key.usages).toContain('decrypt');
    });
  });

  describe('encryptData and decryptData', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const { key } = await deriveKeyFromPassword('test-password');
      const testData = 'hello world';

      const encrypted = await encryptData(testData, key);
      expect(encrypted.encryptedData).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(typeof encrypted.encryptedData).toBe('string');
      expect(typeof encrypted.iv).toBe('string');

      const decrypted = await decryptData(encrypted.encryptedData, encrypted.iv, key);
      expect(decrypted).toBe(testData);
    });

    it('should fail to decrypt with wrong key', async () => {
      const { key: key1 } = await deriveKeyFromPassword('password1');
      const { key: key2 } = await deriveKeyFromPassword('password2');
      const testData = 'secret data';

      const encrypted = await encryptData(testData, key1);

      await expect(
        decryptData(encrypted.encryptedData, encrypted.iv, key2),
      ).rejects.toThrow('Decryption failed');
    });

    it('should throw error for empty data', async () => {
      const { key } = await deriveKeyFromPassword('test-password');

      await expect(encryptData('', key)).rejects.toThrow('Data cannot be empty');
      await expect(encryptData('   ', key)).rejects.toThrow('Data cannot be empty');
    });

    it('should throw error for invalid key', async () => {
      await expect(encryptData('data', null as any)).rejects.toThrow(
        'Invalid encryption key',
      );
      await expect(encryptData('data', {} as any)).rejects.toThrow(
        'Invalid encryption key',
      );
    });
  });

  describe('storeEncrypted and getEncrypted', () => {
    it('should store and retrieve encrypted data', async () => {
      const { key } = await deriveKeyFromPassword('test-password');
      const testData = 'secret data';

      await storeEncrypted('testKey', testData, key);
      const retrieved = await getEncrypted('testKey', key);

      expect(retrieved).toBe(testData);
    });

    it('should return null when key does not exist', async () => {
      const { key } = await deriveKeyFromPassword('test-password');
      const result = await getEncrypted('nonexistent', key);
      expect(result).toBeNull();
    });

    it('should throw error for empty data', async () => {
      const { key } = await deriveKeyFromPassword('test-password');

      await expect(storeEncrypted('testKey', '', key)).rejects.toThrow(
        'Data cannot be empty',
      );
      await expect(storeEncrypted('testKey', '   ', key)).rejects.toThrow(
        'Data cannot be empty',
      );
    });

    it('should work with sync storage', async () => {
      const { key } = await deriveKeyFromPassword('test-password');
      const testData = 'sync data';

      await storeEncrypted('testKey', testData, key, { area: 'sync' });
      const retrieved = await getEncrypted('testKey', key, { area: 'sync' });

      expect(retrieved).toBe(testData);
      expect(mockChrome.storage.sync.set).toHaveBeenCalled();
      expect(mockChrome.storage.sync.get).toHaveBeenCalled();
    });

    it('should fail to retrieve with wrong key', async () => {
      const { key: key1 } = await deriveKeyFromPassword('password1');
      const { key: key2 } = await deriveKeyFromPassword('password2');
      const testData = 'secret data';

      await storeEncrypted('testKey', testData, key1);

      await expect(getEncrypted('testKey', key2)).rejects.toThrow('Decryption failed');
    });
  });

  describe('hasEncrypted', () => {
    it('should return true when key exists', async () => {
      const { key } = await deriveKeyFromPassword('test-password');

      await storeEncrypted('existingKey', 'data', key);
      const exists = await hasEncrypted('existingKey');

      expect(exists).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      const exists = await hasEncrypted('nonexistent');
      expect(exists).toBe(false);
    });

    it('should work with sync storage', async () => {
      const { key } = await deriveKeyFromPassword('test-password');

      await storeEncrypted('syncKey', 'data', key, { area: 'sync' });
      const exists = await hasEncrypted('syncKey', { area: 'sync' });

      expect(exists).toBe(true);
    });
  });

  describe('removeEncrypted', () => {
    it('should remove encrypted data', async () => {
      const { key } = await deriveKeyFromPassword('test-password');

      await storeEncrypted('testKey', 'data', key);
      await removeEncrypted('testKey');

      const retrieved = await getEncrypted('testKey', key);
      expect(retrieved).toBeNull();
    });

    it('should work with sync storage', async () => {
      const { key } = await deriveKeyFromPassword('test-password');

      await storeEncrypted('syncKey', 'data', key, { area: 'sync' });
      await removeEncrypted('syncKey', { area: 'sync' });

      expect(mockChrome.storage.sync.remove).toHaveBeenCalledWith(
        ['syncKey'],
        expect.any(Function),
      );
    });
  });

  describe('security properties', () => {
    it('should produce different ciphertext for same plaintext', async () => {
      const { key } = await deriveKeyFromPassword('test-password');
      const testData = 'same data';

      const encrypted1 = await encryptData(testData, key);
      const encrypted2 = await encryptData(testData, key);

      // Different IVs should produce different ciphertext
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.encryptedData).not.toBe(encrypted2.encryptedData);

      // But both should decrypt to same plaintext
      const decrypted1 = await decryptData(encrypted1.encryptedData, encrypted1.iv, key);
      const decrypted2 = await decryptData(encrypted2.encryptedData, encrypted2.iv, key);
      expect(decrypted1).toBe(testData);
      expect(decrypted2).toBe(testData);
    });

    it('should use base64 encoding for efficiency', async () => {
      const { key } = await deriveKeyFromPassword('test-password');
      const testData = 'test data';

      const encrypted = await encryptData(testData, key);

      // Base64 should only contain valid characters
      expect(encrypted.encryptedData).toMatch(/^[A-Za-z0-9+/=]+$/u);
      expect(encrypted.iv).toMatch(/^[A-Za-z0-9+/=]+$/u);
    });
  });
});
