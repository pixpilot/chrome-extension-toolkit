/**
 * Default encryption provider implementation
 * Uses the generic secure-storage utilities to provide a standard
 * encryption provider for chrome-storage
 *
 * SECURITY NOTICE:
 * This provider requires a CryptoKey to be provided. The key should be
 * derived from a user password using deriveKeyFromPassword() and kept
 * in memory only. Never store the encryption key itself.
 */

import type { EncryptionProvider } from './chrome-storage';
import type { SecureStorageOptions } from './secure-storage';
import {
  getEncrypted,
  hasEncrypted,
  removeEncrypted,
  storeEncrypted,
} from './secure-storage';

/**
 * Options for configuring the DefaultEncryptionProvider
 */
export interface DefaultEncryptionProviderOptions extends SecureStorageOptions {
  /**
   * Prefix to add to all storage keys
   * Useful for namespacing encrypted data
   */
  keyPrefix?: string;

  /**
   * The encryption key to use for all operations
   * REQUIRED: Must be provided (typically derived from user password)
   *
   * @example
   * ```typescript
   * import { deriveKeyFromPassword } from './secure-storage';
   *
   * const { key } = await deriveKeyFromPassword('user-password');
   * const provider = new DefaultEncryptionProvider({ key });
   * ```
   */
  key: CryptoKey;
}

/**
 * Default implementation of EncryptionProvider using secure-storage utilities
 *
 * This provider uses AES-GCM encryption with a user-provided 256-bit key.
 * Each encrypted value has its own initialization vector (IV).
 *
 * The encryption key is NEVER stored - it must be provided by the application
 * and is typically derived from a user password.
 *
 * @example
 * ```typescript
 * import { deriveKeyFromPassword } from './secure-storage';
 *
 * // Derive key from user password
 * const { key, salt } = await deriveKeyFromPassword('user-password');
 * // Store salt for later (it's safe to store, not the key!)
 *
 * // Create provider with the derived key
 * const provider = new DefaultEncryptionProvider({ key });
 * await provider.encrypt('myKey', 'sensitive data');
 * const data = await provider.decrypt('myKey');
 * ```
 *
 * @example With custom options
 * ```typescript
 * const { key } = await deriveKeyFromPassword('user-password', storedSalt);
 * const provider = new DefaultEncryptionProvider({
 *   key,
 *   area: 'sync',
 *   keyPrefix: 'app_',
 * });
 * ```
 */
export class DefaultEncryptionProvider implements EncryptionProvider {
  private options: DefaultEncryptionProviderOptions;
  private key: CryptoKey;

  constructor(options: DefaultEncryptionProviderOptions) {
    if (!options.key) {
      throw new Error(
        'Encryption key is required. Use deriveKeyFromPassword() to create a key.',
      );
    }

    this.key = options.key;
    this.options = {
      area: 'local',
      ...options,
    };
  }

  /**
   * Get the storage key with optional prefix
   */
  private getStorageKey(key: string): string {
    return this.options.keyPrefix ? `${this.options.keyPrefix}${key}` : key;
  }

  /**
   * Encrypt and store a value
   *
   * @param key - The key to store the encrypted value under
   * @param value - The string value to encrypt
   * @throws Error if encryption or storage fails
   */
  async encrypt(key: string, value: string): Promise<void> {
    const storageKey = this.getStorageKey(key);
    await storeEncrypted(storageKey, value, this.key, this.options);
  }

  /**
   * Retrieve and decrypt a value
   *
   * @param key - The key to retrieve the encrypted value from
   * @returns The decrypted value, or null if not found
   * @throws Error if decryption fails (wrong key or corrupted data)
   */
  async decrypt(key: string): Promise<string | null> {
    const storageKey = this.getStorageKey(key);
    return await getEncrypted(storageKey, this.key, this.options);
  }

  /**
   * Remove an encrypted value from storage
   *
   * @param key - The key to remove
   * @throws Error if removal fails
   */
  async remove(key: string): Promise<void> {
    const storageKey = this.getStorageKey(key);
    await removeEncrypted(storageKey, this.options);
  }

  /**
   * Check if an encrypted value exists in storage
   *
   * @param key - The key to check
   * @returns True if the key exists, false otherwise
   */
  async has(key: string): Promise<boolean> {
    const storageKey = this.getStorageKey(key);
    return await hasEncrypted(storageKey, this.options);
  }
}
