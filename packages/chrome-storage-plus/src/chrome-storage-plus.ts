/**
 * Generic Chrome Storage API
 * Provides a consistent interface for all extension storage operations
 * Supports both encrypted (secure) and plain storage with configurable encryption
 */

export type StorageArea = 'local' | 'sync';

export interface StorageOptions {
  area?: StorageArea;
  encrypted?: boolean;
}

export interface StorageGetResult<T = unknown> {
  [key: string]: T;
}

export interface EncryptionProvider {
  encrypt: (key: string, value: string) => Promise<void>;
  decrypt: (key: string) => Promise<string | null>;
  remove: (key: string) => Promise<void>;
  has: (key: string) => Promise<boolean>;
}

export interface GenericChromeStorageOptions {
  /** Function to generate a prefixed key for development or namespacing */
  keyTransformer?: (key: string) => string;
  /**
   * Optional encryption provider for secure storage
   * REQUIRED for encryption support - you must provide an encryption provider
   * with a key (use DefaultEncryptionProvider with a derived key)
   * Set to null to disable encryption support entirely
   *
   * @example
   * ```typescript
   * import { deriveKeyFromPassword } from './secure-storage';
   * import { DefaultEncryptionProvider } from './default-encryption-provider';
   *
   * const { key } = await deriveKeyFromPassword('user-password');
   * const provider = new DefaultEncryptionProvider({ key });
   * const manager = new ChromeStoragePlus({ encryptionProvider: provider });
   * ```
   */
  encryptionProvider?: EncryptionProvider | null;
}

/**
 * Generic Chrome Storage Manager
 * All methods throw errors on failure for clean error handling
 */
export class ChromeStoragePlus {
  private keyTransformer: (key: string) => string;
  private encryptionProvider?: EncryptionProvider;

  constructor(options: GenericChromeStorageOptions = {}) {
    this.keyTransformer = options.keyTransformer ?? ((key: string) => key);

    // Use provided encryption provider or null (no encryption)
    // NOTE: DefaultEncryptionProvider is no longer created automatically
    // because it requires a user-provided key for security
    if (options.encryptionProvider !== undefined) {
      this.encryptionProvider = options.encryptionProvider ?? undefined;
    }
  }

  /**
   * Get a single item from storage
   * @throws Error if operation fails or encryption provider not configured
   */
  async get<T = unknown>(
    key: string,
    options: StorageOptions = {},
  ): Promise<T | undefined> {
    const { area = 'local', encrypted = false } = options;

    if (encrypted) {
      if (!this.encryptionProvider) {
        throw new Error('Encryption provider not configured');
      }

      const transformedKey = this.keyTransformer(key);
      const data = await this.encryptionProvider.decrypt(transformedKey);
      if (data === null) {
        return undefined;
      }

      // Deserialize the decrypted JSON string back to the original type
      try {
        return JSON.parse(data) as T;
      } catch (error) {
        console.warn(`Failed to parse decrypted data for key: ${key}`, error);
        return undefined;
      }
    }

    const result = await new Promise<StorageGetResult<T>>((resolve, reject) => {
      chrome.storage[area].get([this.keyTransformer(key)], (storageResult) => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(
              `chrome.storage.${area}.get failed: ${chrome.runtime.lastError.message}`,
            ),
          );
        } else {
          resolve(storageResult);
        }
      });
    });

    return result[this.keyTransformer(key)];
  }

  /**
   * Get multiple items from storage
   * @throws Error if operation fails
   */
  async getMultiple<T = unknown>(
    keys: string[],
    options: StorageOptions = {},
  ): Promise<StorageGetResult<T>> {
    const { area = 'local', encrypted = false } = options;

    if (encrypted) {
      if (!this.encryptionProvider) {
        throw new Error('Encryption provider not configured');
      }

      // Handle encrypted keys individually
      const result: StorageGetResult<T> = {};
      await Promise.all(
        keys.map(async (key) => {
          const value = await this.get<T>(key, { encrypted: true });
          if (value !== undefined) {
            result[key] = value;
          }
        }),
      );
      return result;
    }

    const transformedKeys = keys.map((key) => this.keyTransformer(key));
    const result = await new Promise<StorageGetResult<T>>((resolve, reject) => {
      chrome.storage[area].get(transformedKeys, (storageResult) => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(
              `chrome.storage.${area}.get failed: ${chrome.runtime.lastError.message}`,
            ),
          );
        } else {
          resolve(storageResult);
        }
      });
    });

    // Map back to original keys
    const originalResult: StorageGetResult<T> = {};
    keys.forEach((key) => {
      const transformedKey = this.keyTransformer(key);
      const value = result[transformedKey];
      if (value !== undefined) {
        originalResult[key] = value;
      }
    });

    return originalResult;
  }

  /**
   * Set a single item in storage
   * @throws Error if operation fails
   */
  async set<T = unknown>(
    key: string,
    value: T,
    options: StorageOptions = {},
  ): Promise<void> {
    const { area = 'local', encrypted = false } = options;

    const transformedKey = this.keyTransformer(key);

    if (encrypted) {
      if (!this.encryptionProvider) {
        throw new Error('Encryption provider not configured');
      }

      // Serialize value to JSON string before encryption
      const serialized = JSON.stringify(value);
      await this.encryptionProvider.encrypt(transformedKey, serialized);
      return;
    }

    await new Promise<void>((resolve, reject) => {
      chrome.storage[area].set({ [transformedKey]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(
              `chrome.storage.${area}.set failed: ${chrome.runtime.lastError.message}`,
            ),
          );
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Set multiple items in storage
   * @throws Error if operation fails
   */
  async setMultiple<T = unknown>(
    items: Record<string, T>,
    options: StorageOptions = {},
  ): Promise<void> {
    const { area = 'local', encrypted = false } = options;

    if (encrypted) {
      if (!this.encryptionProvider) {
        throw new Error('Encryption provider not configured');
      }

      // Handle encrypted keys individually
      await Promise.all(
        Object.entries(items).map(async ([key, value]) => {
          await this.set(key, value, { encrypted: true });
        }),
      );
      return;
    }

    // Transform the keys in the items object
    const transformedItems: Record<string, T> = {};
    Object.entries(items).forEach(([key, value]) => {
      transformedItems[this.keyTransformer(key)] = value;
    });

    await new Promise<void>((resolve, reject) => {
      chrome.storage[area].set(transformedItems, () => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(
              `chrome.storage.${area}.set failed: ${chrome.runtime.lastError.message}`,
            ),
          );
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Remove items from storage
   * @throws Error if operation fails
   */
  async remove(keys: string | string[], options: StorageOptions = {}): Promise<void> {
    const { area = 'local', encrypted = false } = options;
    const keyArray = Array.isArray(keys) ? keys : [keys];

    if (encrypted) {
      if (!this.encryptionProvider) {
        throw new Error('Encryption provider not configured');
      }

      await Promise.all(
        keyArray.map(async (key) => {
          const transformedKey = this.keyTransformer(key);
          await this.encryptionProvider!.remove(transformedKey);
        }),
      );
      return;
    }

    const transformedKeys = keyArray.map((key) => this.keyTransformer(key));

    await new Promise<void>((resolve, reject) => {
      chrome.storage[area].remove(transformedKeys, () => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(
              `chrome.storage.${area}.remove failed: ${chrome.runtime.lastError.message}`,
            ),
          );
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Clear all data from storage area
   * @throws Error if operation fails
   */
  async clear(options: StorageOptions = {}): Promise<void> {
    const { area = 'local' } = options;

    await new Promise<void>((resolve, reject) => {
      chrome.storage[area].clear(() => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(
              `chrome.storage.${area}.clear failed: ${chrome.runtime.lastError.message}`,
            ),
          );
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Check if a key exists in storage
   * @throws Error if operation fails
   */
  async has(key: string, options: StorageOptions = {}): Promise<boolean> {
    const { encrypted = false } = options;

    if (encrypted) {
      if (!this.encryptionProvider) {
        throw new Error('Encryption provider not configured');
      }

      const transformedKey = this.keyTransformer(key);
      return await this.encryptionProvider.has(transformedKey);
    }

    const value = await this.get(key, options);
    return value !== undefined;
  }

  /**
   * Get all items from storage area
   * @throws Error if operation fails
   */
  async getAll<T = unknown>(options: StorageOptions = {}): Promise<StorageGetResult<T>> {
    const { area = 'local' } = options;

    const result = await new Promise<StorageGetResult<T>>((resolve, reject) => {
      chrome.storage[area].get(null, (storageResult) => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(
              `chrome.storage.${area}.get failed: ${chrome.runtime.lastError.message}`,
            ),
          );
        } else {
          resolve(storageResult);
        }
      });
    });

    return result;
  }

  /**
   * Get storage usage information
   * @throws Error if operation fails
   */
  async getBytesInUse(
    keys?: string | string[],
    options: StorageOptions = {},
  ): Promise<number> {
    const { area = 'local' } = options;

    let transformedKeys: string[] | null = null;
    if (keys !== undefined) {
      if (Array.isArray(keys)) {
        transformedKeys = keys.map((k) => this.keyTransformer(k));
      } else {
        transformedKeys = [this.keyTransformer(keys)];
      }
    }

    const bytes = await new Promise<number>((resolve, reject) => {
      chrome.storage[area].getBytesInUse(transformedKeys, (bytesUsed) => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(
              `chrome.storage.${area}.getBytesInUse failed: ${chrome.runtime.lastError.message}`,
            ),
          );
        } else {
          resolve(bytesUsed);
        }
      });
    });

    return bytes;
  }
}

/**
 * Create convenience functions for a storage manager instance
 */
export function createStorageAPI(manager: ChromeStoragePlus): {
  get: <T = unknown>(key: string, options?: StorageOptions) => Promise<T | undefined>;
  getMultiple: <T = unknown>(
    keys: string[],
    options?: StorageOptions,
  ) => Promise<StorageGetResult<T>>;
  getAll: <T = unknown>(options?: StorageOptions) => Promise<StorageGetResult<T>>;
  set: <T = unknown>(key: string, value: T, options?: StorageOptions) => Promise<void>;
  setMultiple: <T = unknown>(
    items: Record<string, T>,
    options?: StorageOptions,
  ) => Promise<void>;
  remove: (keys: string | string[], options?: StorageOptions) => Promise<void>;
  clear: (options?: StorageOptions) => Promise<void>;
  has: (key: string, options?: StorageOptions) => Promise<boolean>;
  getBytesInUse: (keys?: string | string[], options?: StorageOptions) => Promise<number>;
} {
  return {
    // Get operations
    get: async <T = unknown>(
      key: string,
      options?: StorageOptions,
    ): Promise<T | undefined> => manager.get<T>(key, options),
    getMultiple: async <T = unknown>(
      keys: string[],
      options?: StorageOptions,
    ): Promise<StorageGetResult<T>> => manager.getMultiple<T>(keys, options),
    getAll: async <T = unknown>(options?: StorageOptions): Promise<StorageGetResult<T>> =>
      manager.getAll<T>(options),

    // Set operations
    set: async <T = unknown>(
      key: string,
      value: T,
      options?: StorageOptions,
    ): Promise<void> => manager.set(key, value, options),
    setMultiple: async <T = unknown>(
      items: Record<string, T>,
      options?: StorageOptions,
    ): Promise<void> => manager.setMultiple(items, options),

    // Remove operations
    remove: async (keys: string | string[], options?: StorageOptions): Promise<void> =>
      manager.remove(keys, options),
    clear: async (options?: StorageOptions): Promise<void> => manager.clear(options),

    // Utility operations
    has: async (key: string, options?: StorageOptions): Promise<boolean> =>
      manager.has(key, options),
    getBytesInUse: async (
      keys?: string | string[],
      options?: StorageOptions,
    ): Promise<number> => manager.getBytesInUse(keys, options),
  };
}
