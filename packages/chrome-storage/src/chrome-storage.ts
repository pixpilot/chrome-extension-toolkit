/**
 * Generic Chrome Storage API
 * Provides a consistent interface for all extension storage operations
 * Supports both encrypted (secure) and plain storage with configurable encryption
 */

import type { StorageChangeCallback } from './storage-listener';

import { StorageListener } from './storage-listener';

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
   * const manager = new ChromeStorage({ encryptionProvider: provider });
   * ```
   */
  encryptionProvider?: EncryptionProvider | null;
}

/**
 * Generic Chrome Storage Manager
 * All methods throw errors on failure for clean error handling
 * @template TSchema Optional schema object type for type-safe keys and values
 * @example
 * ```typescript
 * type MyStorage = {
 *   username: string;
 *   settings: { theme: string };
 *   count: number;
 * };
 * const storage = new ChromeStorage<MyStorage>();
 * // Now get('username') returns string | undefined
 * // and get('invalid') causes a TypeScript error
 * ```
 */
export class ChromeStorage<TSchema = Record<string, unknown>> {
  private keyTransformer: (key: string) => string;
  private encryptionProvider?: EncryptionProvider;
  private storageListener: StorageListener;

  constructor(options: GenericChromeStorageOptions = {}) {
    this.keyTransformer = options.keyTransformer ?? ((key: string) => key);

    // Use provided encryption provider or null (no encryption)
    // NOTE: DefaultEncryptionProvider is no longer created automatically
    // because it requires a user-provided key for security
    if (options.encryptionProvider !== undefined) {
      this.encryptionProvider = options.encryptionProvider ?? undefined;
    }

    // Initialize storage listener
    this.storageListener = new StorageListener();
  }

  /**
   * Get a single item from storage
   * @throws Error if operation fails or encryption provider not configured
   */
  async get<K extends keyof TSchema>(
    key: K,
    options: StorageOptions = {},
  ): Promise<TSchema[K] | undefined> {
    const { area = 'local', encrypted = false } = options;

    if (encrypted) {
      if (!this.encryptionProvider) {
        throw new Error('Encryption provider not configured');
      }

      const transformedKey = this.keyTransformer(key as string);
      const data = await this.encryptionProvider.decrypt(transformedKey);
      if (data === null) {
        return undefined;
      }

      // Deserialize the decrypted JSON string back to the original type
      try {
        return JSON.parse(data) as TSchema[K];
      } catch (error) {
        console.warn(`Failed to parse decrypted data for key: ${String(key)}`, error);
        return undefined;
      }
    }

    const result = await new Promise<StorageGetResult<TSchema[K]>>((resolve, reject) => {
      chrome.storage[area].get([this.keyTransformer(key as string)], (storageResult) => {
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

    return result[this.keyTransformer(key as string)];
  }

  /**
   * Get a single item from storage and immediately remove it
   * Useful for one-time tokens, temporary data, or message passing
   * @throws Error if operation fails or encryption provider not configured
   */
  async getOnce<K extends keyof TSchema>(
    key: K,
    options: StorageOptions = {},
  ): Promise<TSchema[K] | undefined> {
    const value = await this.get(key, options);

    // Only remove if value existed
    if (value !== undefined) {
      await this.remove(key, options);
    }

    return value;
  }

  /**
   * Get multiple items from storage
   * @throws Error if operation fails
   */
  async getMultiple<K extends keyof TSchema>(
    keys: readonly K[],
    options: StorageOptions = {},
  ): Promise<Partial<Pick<TSchema, K>>> {
    const { area = 'local', encrypted = false } = options;

    if (encrypted) {
      if (!this.encryptionProvider) {
        throw new Error('Encryption provider not configured');
      }

      // Handle encrypted keys individually
      const result: Partial<Pick<TSchema, K>> = {};
      await Promise.all(
        keys.map(async (key) => {
          const value = await this.get(key, { encrypted: true });
          if (value !== undefined) {
            result[key] = value;
          }
        }),
      );
      return result;
    }

    const transformedKeys = keys.map((key) => this.keyTransformer(key as string));
    const storageResult = await new Promise<Record<string, unknown>>(
      (resolve, reject) => {
        chrome.storage[area].get(transformedKeys, (result) => {
          if (chrome.runtime.lastError) {
            reject(
              new Error(
                `chrome.storage.${area}.get failed: ${chrome.runtime.lastError.message}`,
              ),
            );
          } else {
            resolve(result);
          }
        });
      },
    );

    // Map back to original keys
    const originalResult: Partial<Pick<TSchema, K>> = {};
    keys.forEach((key) => {
      const transformedKey = this.keyTransformer(key as string);
      const value = storageResult[transformedKey];
      if (value !== undefined) {
        originalResult[key] = value as TSchema[K];
      }
    });

    return originalResult;
  }

  /**
   * Set a single item in storage
   * @throws Error if operation fails
   */
  async set<K extends keyof TSchema>(
    key: K,
    value: TSchema[K],
    options: StorageOptions = {},
  ): Promise<void> {
    const { area = 'local', encrypted = false } = options;

    const transformedKey = this.keyTransformer(key as string);

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
  async setMultiple<K extends keyof TSchema>(
    items: Partial<Pick<TSchema, K>>,
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
          await this.set(key as K, value as TSchema[K], { encrypted: true });
        }),
      );
      return;
    }

    // Transform the keys in the items object
    const transformedItems: Record<string, unknown> = {};
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
  async remove(
    keys: keyof TSchema | (keyof TSchema)[],
    options: StorageOptions = {},
  ): Promise<void> {
    const { area = 'local', encrypted = false } = options;
    const keyArray = Array.isArray(keys) ? keys : [keys];

    if (encrypted) {
      if (!this.encryptionProvider) {
        throw new Error('Encryption provider not configured');
      }

      await Promise.all(
        keyArray.map(async (key) => {
          const transformedKey = this.keyTransformer(key as string);
          await this.encryptionProvider!.remove(transformedKey);
        }),
      );
      return;
    }

    const transformedKeys = keyArray.map((key) => this.keyTransformer(key as string));

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
  async has(key: keyof TSchema | string, options: StorageOptions = {}): Promise<boolean> {
    const { area = 'local', encrypted = false } = options;

    if (encrypted) {
      if (!this.encryptionProvider) {
        throw new Error('Encryption provider not configured');
      }

      const transformedKey = this.keyTransformer(key as string);
      return await this.encryptionProvider.has(transformedKey);
    }

    // For has, we allow any string key, so we need to check chrome.storage directly
    const transformedKey = this.keyTransformer(key as string);
    const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
      chrome.storage[area].get([transformedKey], (storageResult) => {
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

    return result[transformedKey] !== undefined;
  }

  /**
   * Get all items from storage area
   * @throws Error if operation fails
   */
  async getAll(options: StorageOptions = {}): Promise<Partial<TSchema>> {
    const { area = 'local' } = options;

    const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
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

    return result as Partial<TSchema>;
  }

  /**
   * Get storage usage information
   * @throws Error if operation fails
   */
  async getBytesInUse(
    keys?: keyof TSchema | (keyof TSchema)[],
    options: StorageOptions = {},
  ): Promise<number> {
    const { area = 'local' } = options;

    let transformedKeys: string[] | null = null;
    if (keys !== undefined) {
      if (Array.isArray(keys)) {
        transformedKeys = keys.map((k) => this.keyTransformer(k as string));
      } else {
        transformedKeys = [this.keyTransformer(keys as string)];
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

  /**
   * Watch for changes to a specific storage key
   * Returns an unsubscribe function to stop listening
   *
   * @param key - The storage key to watch
   * @param callback - Function called when the key changes
   * @param options - Storage options (area filter)
   * @returns A function to remove the listener
   *
   * @example
   * ```typescript
   * // Watch for username changes
   * const unsubscribe = storage.watch('username', (change, key, area) => {
   *   console.log(`${key} changed from ${change.oldValue} to ${change.newValue}`);
   *   console.log(`Changed in ${area} storage`);
   * });
   *
   * // Later, stop watching
   * unsubscribe();
   * ```
   *
   * @example
   * ```typescript
   * // Watch only local storage changes
   * const unsubscribe = storage.watch(
   *   'settings',
   *   (change) => {
   *     console.log('Settings updated:', change.newValue);
   *   },
   *   { area: 'local' }
   * );
   * ```
   */
  watch<K extends keyof TSchema>(
    key: K,
    callback: StorageChangeCallback<TSchema[K]>,
    options: Pick<StorageOptions, 'area'> = {},
  ): () => void {
    const transformedKey = this.keyTransformer(key as string);
    const { area } = options;

    return this.storageListener.addListener(transformedKey, callback, area);
  }
}
