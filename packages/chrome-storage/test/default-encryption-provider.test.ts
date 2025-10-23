import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DefaultEncryptionProvider } from '../src/default-encryption-provider';
import * as secureStorage from '../src/secure-storage';

// Mock the secure-storage module
vi.mock('../src/secure-storage', () => ({
  storeEncrypted: vi.fn(),
  getEncrypted: vi.fn(),
  removeEncrypted: vi.fn(),
  hasEncrypted: vi.fn(),
  deriveKeyFromPassword: vi.fn(),
}));

// Create a mock CryptoKey
function createMockKey(): CryptoKey {
  return {
    type: 'secret',
    extractable: false,
    algorithm: { name: 'AES-GCM', length: 256 },
    usages: ['encrypt', 'decrypt'],
  } as CryptoKey;
}

describe('defaultEncryptionProvider', () => {
  let provider: DefaultEncryptionProvider;
  let mockKey: CryptoKey;

  beforeEach(() => {
    mockKey = createMockKey();
    provider = new DefaultEncryptionProvider({ key: mockKey });
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with required key', () => {
      const key = createMockKey();
      const providerInstance = new DefaultEncryptionProvider({ key });
      expect(providerInstance).toBeInstanceOf(DefaultEncryptionProvider);
    });

    it('should throw error if key is not provided', () => {
      expect(() => new DefaultEncryptionProvider({} as any)).toThrow(
        'Encryption key is required',
      );
    });

    it('should accept custom options', () => {
      const key = createMockKey();
      const customProvider = new DefaultEncryptionProvider({
        key,
        area: 'sync',
        keyPrefix: 'test_',
      });
      expect(customProvider).toBeInstanceOf(DefaultEncryptionProvider);
    });
  });

  describe('encrypt', () => {
    it('should call storeEncrypted with correct parameters', async () => {
      await provider.encrypt('testKey', 'testValue');

      expect(secureStorage.storeEncrypted).toHaveBeenCalledWith(
        'testKey',
        'testValue',
        mockKey,
        {
          area: 'local',
          key: mockKey,
        },
      );
    });

    it('should use key prefix when provided', async () => {
      const key = createMockKey();
      const prefixedProvider = new DefaultEncryptionProvider({ key, keyPrefix: 'app_' });
      await prefixedProvider.encrypt('testKey', 'testValue');

      expect(secureStorage.storeEncrypted).toHaveBeenCalledWith(
        'app_testKey',
        'testValue',
        key,
        expect.any(Object),
      );
    });

    it('should pass custom storage area', async () => {
      const key = createMockKey();
      const syncProvider = new DefaultEncryptionProvider({ key, area: 'sync' });
      await syncProvider.encrypt('testKey', 'testValue');

      expect(secureStorage.storeEncrypted).toHaveBeenCalledWith(
        'testKey',
        'testValue',
        key,
        {
          area: 'sync',
          key,
        },
      );
    });

    it('should propagate errors from storeEncrypted', async () => {
      const error = new Error('Encryption failed');
      vi.mocked(secureStorage.storeEncrypted).mockRejectedValue(error);

      await expect(provider.encrypt('testKey', 'testValue')).rejects.toThrow(
        'Encryption failed',
      );
    });
  });

  describe('decrypt', () => {
    it('should call getEncrypted with correct parameters', async () => {
      vi.mocked(secureStorage.getEncrypted).mockResolvedValue('decryptedValue');

      const result = await provider.decrypt('testKey');

      expect(secureStorage.getEncrypted).toHaveBeenCalledWith('testKey', mockKey, {
        area: 'local',
        key: mockKey,
      });
      expect(result).toBe('decryptedValue');
    });

    it('should return null for non-existent key', async () => {
      vi.mocked(secureStorage.getEncrypted).mockResolvedValue(null);

      const result = await provider.decrypt('nonExistentKey');

      expect(result).toBeNull();
    });

    it('should use key prefix when provided', async () => {
      const key = createMockKey();
      const prefixedProvider = new DefaultEncryptionProvider({ key, keyPrefix: 'app_' });
      await prefixedProvider.decrypt('testKey');

      expect(secureStorage.getEncrypted).toHaveBeenCalledWith(
        'app_testKey',
        key,
        expect.any(Object),
      );
    });

    it('should propagate errors from getEncrypted', async () => {
      const error = new Error('Decryption failed');
      vi.mocked(secureStorage.getEncrypted).mockRejectedValue(error);

      await expect(provider.decrypt('testKey')).rejects.toThrow('Decryption failed');
    });
  });

  describe('remove', () => {
    it('should call removeEncrypted with correct parameters', async () => {
      await provider.remove('testKey');

      expect(secureStorage.removeEncrypted).toHaveBeenCalledWith('testKey', {
        area: 'local',
        key: mockKey,
      });
    });

    it('should use key prefix when provided', async () => {
      const key = createMockKey();
      const prefixedProvider = new DefaultEncryptionProvider({ key, keyPrefix: 'app_' });
      await prefixedProvider.remove('testKey');

      expect(secureStorage.removeEncrypted).toHaveBeenCalledWith(
        'app_testKey',
        expect.any(Object),
      );
    });

    it('should propagate errors from removeEncrypted', async () => {
      const error = new Error('Remove failed');
      vi.mocked(secureStorage.removeEncrypted).mockRejectedValue(error);

      await expect(provider.remove('testKey')).rejects.toThrow('Remove failed');
    });
  });

  describe('has', () => {
    it('should call hasEncrypted with correct parameters', async () => {
      vi.mocked(secureStorage.hasEncrypted).mockResolvedValue(true);

      const result = await provider.has('testKey');

      expect(secureStorage.hasEncrypted).toHaveBeenCalledWith('testKey', {
        area: 'local',
        key: mockKey,
      });
      expect(result).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      vi.mocked(secureStorage.hasEncrypted).mockResolvedValue(false);

      const result = await provider.has('nonExistentKey');

      expect(result).toBe(false);
    });

    it('should use key prefix when provided', async () => {
      const key = createMockKey();
      const prefixedProvider = new DefaultEncryptionProvider({ key, keyPrefix: 'app_' });
      await prefixedProvider.has('testKey');

      expect(secureStorage.hasEncrypted).toHaveBeenCalledWith(
        'app_testKey',
        expect.any(Object),
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete encrypt-decrypt cycle', async () => {
      vi.mocked(secureStorage.storeEncrypted).mockResolvedValue();
      vi.mocked(secureStorage.getEncrypted).mockResolvedValue('secret data');

      await provider.encrypt('apiKey', 'secret data');
      const result = await provider.decrypt('apiKey');

      expect(result).toBe('secret data');
    });

    it('should handle remove after encrypt', async () => {
      vi.mocked(secureStorage.storeEncrypted).mockResolvedValue();
      vi.mocked(secureStorage.removeEncrypted).mockResolvedValue();
      vi.mocked(secureStorage.hasEncrypted)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await provider.encrypt('tempKey', 'temp data');
      expect(await provider.has('tempKey')).toBe(true);

      await provider.remove('tempKey');
      expect(await provider.has('tempKey')).toBe(false);
    });
  });
});
