/**
 * Generic secure storage utilities for Chrome extension
 * Uses Web Crypto API for encryption and Chrome storage API for persistence
 *
 * SECURITY NOTICE:
 * This module requires users to provide their own encryption keys.
 * Keys are NEVER stored - they must be derived from user passwords or
 * managed by the calling application. This ensures that access to
 * chrome.storage alone is not sufficient to decrypt the data.
 *
 * RECOMMENDED USAGE:
 * 1. Use `deriveKeyFromPassword()` to create a key from user input
 * 2. Store the salt securely (it's not secret, but needed for key derivation)
 * 3. Pass the derived key to encryption/decryption functions
 * 4. Clear the key from memory when done
 *
 * @example
 * ```typescript
 * // Derive key from user password
 * const { key, salt } = await deriveKeyFromPassword('user-password');
 *
 * // Store encrypted data
 * await storeEncrypted('myKey', 'secret data', key);
 *
 * // Retrieve encrypted data (requires same key)
 * const data = await getEncrypted('myKey', key);
 * ```
 */

const IV_LENGTH = 12;
const PBKDF2_ITERATIONS = 210000; // OWASP recommendation (2025 minimum)
const SALT_LENGTH = 16;

/**
 * Stored encrypted data format using base64 encoding for efficiency
 */
export interface StoredEncryptedData {
  /** Base64-encoded encrypted data */
  encryptedData: string;
  /** Base64-encoded initialization vector */
  iv: string;
}

/**
 * Result of key derivation from password
 */
export interface DerivedKeyResult {
  /** The derived CryptoKey (keep in memory, never store) */
  key: CryptoKey;
  /** Base64-encoded salt (safe to store, needed for re-derivation) */
  salt: string;
}

interface StorageResult {
  [key: string]: unknown;
}

/**
 * Options for secure storage operations
 */
export interface SecureStorageOptions {
  /**
   * Storage area to use ('local' or 'sync')
   * @default 'local'
   *
   * WARNING: 'sync' has a 100KB limit per item. Encrypted data is larger
   * than plaintext, so consider this when choosing storage area.
   */
  area?: 'local' | 'sync';
}

/**
 * Derive a cryptographic key from a password using PBKDF2
 *
 * This is the RECOMMENDED way to create encryption keys. The derived key
 * should be kept in memory and never stored. Store only the salt, which
 * is needed to re-derive the same key from the password later.
 *
 * @param password - User's password (will be used to derive the key)
 * @param existingSalt - Optional base64-encoded salt for re-deriving a key
 * @returns Promise with the derived key and salt
 *
 * @example
 * ```typescript
 * // First time: generate new key and salt
 * const { key, salt } = await deriveKeyFromPassword('user-password');
 * // Store salt somewhere (it's safe to store, not the key!)
 *
 * // Later: re-derive the same key using stored salt
 * const { key: sameKey } = await deriveKeyFromPassword('user-password', storedSalt);
 * ```
 */
export async function deriveKeyFromPassword(
  password: string,
  existingSalt?: string,
): Promise<DerivedKeyResult> {
  if (!password || password.trim() === '') {
    throw new Error('Password cannot be empty');
  }

  // Generate or decode salt
  const salt = existingSalt
    ? base64ToUint8Array(existingSalt)
    : crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  // Import password as key material
  const passwordBuffer = new TextEncoder().encode(password);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  );

  // Derive AES-GCM key from password
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // Key is non-exportable for security
    ['encrypt', 'decrypt'],
  );

  return {
    key,
    salt: uint8ArrayToBase64(salt),
  };
}

/**
 * Generate a random encryption key (alternative to password-based derivation)
 *
 * Use this if you want to generate a random key instead of deriving from password.
 * WARNING: You are responsible for securely managing this key. Consider using
 * deriveKeyFromPassword() instead for better security.
 *
 * @returns Promise with a CryptoKey suitable for AES-GCM encryption
 *
 * @example
 * ```typescript
 * const key = await generateEncryptionKey();
 * // You must handle key storage/management yourself
 * ```
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // Non-exportable for security
    ['encrypt', 'decrypt'],
  );
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const binString = atob(base64);
  const bytes = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) {
    bytes[i] = binString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(array: Uint8Array): string {
  const bytes = Array.from(array);
  const binString = String.fromCharCode(...bytes);
  return btoa(binString);
}

/**
 * Encrypt data using AES-GCM with a user-provided key
 *
 * @param data - The string data to encrypt
 * @param key - The CryptoKey to use for encryption (from deriveKeyFromPassword or generateEncryptionKey)
 * @returns Promise that resolves to the encrypted data with IV (both base64-encoded)
 *
 * @example
 * ```typescript
 * const { key } = await deriveKeyFromPassword('user-password');
 * const encrypted = await encryptData('secret data', key);
 * ```
 */
export async function encryptData(
  data: string,
  key: CryptoKey,
): Promise<StoredEncryptedData> {
  if (!data || data.trim() === '') {
    throw new Error('Data cannot be empty');
  }

  if (!key || key.type !== 'secret') {
    throw new Error('Invalid encryption key provided');
  }

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  // Generate a random IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBuffer,
  );

  return {
    encryptedData: uint8ArrayToBase64(new Uint8Array(encryptedBuffer)),
    iv: uint8ArrayToBase64(iv),
  };
}

/**
 * Decrypt data using AES-GCM with a user-provided key
 *
 * @param encryptedData - The base64-encoded encrypted data
 * @param iv - The base64-encoded initialization vector
 * @param key - The CryptoKey to use for decryption (must be the same key used for encryption)
 * @returns Promise that resolves to the decrypted string
 * @throws Error if decryption fails (wrong key or corrupted data)
 *
 * @example
 * ```typescript
 * const { key } = await deriveKeyFromPassword('user-password', storedSalt);
 * const decrypted = await decryptData(encrypted.encryptedData, encrypted.iv, key);
 * ```
 */
export async function decryptData(
  encryptedData: string,
  iv: string,
  key: CryptoKey,
): Promise<string> {
  if (!key || key.type !== 'secret') {
    throw new Error('Invalid decryption key provided');
  }

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToUint8Array(iv) },
      key,
      base64ToUint8Array(encryptedData),
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch {
    // AES-GCM throws if authentication fails (wrong key or tampered data)
    throw new Error('Decryption failed: Invalid key or corrupted data');
  }
}

/**
 * Store encrypted data in Chrome storage
 *
 * @param storageKey - The key to store the data under
 * @param data - The string data to encrypt and store
 * @param key - The CryptoKey to use for encryption
 * @param options - Options for storage (area: 'local' or 'sync')
 * @returns Promise that resolves when storage is complete
 *
 * @example
 * ```typescript
 * const { key } = await deriveKeyFromPassword('user-password');
 * await storeEncrypted('myData', 'secret value', key);
 * ```
 */
export async function storeEncrypted(
  storageKey: string,
  data: string,
  key: CryptoKey,
  options: SecureStorageOptions = {},
): Promise<void> {
  const { area = 'local' } = options;

  if (!data || data.trim() === '') {
    throw new Error('Data cannot be empty');
  }

  try {
    const encrypted = await encryptData(data.trim(), key);

    return await new Promise<void>((resolve, reject) => {
      chrome.storage[area].set({ [storageKey]: encrypted }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  } catch (error) {
    throw new Error(`Failed to store encrypted data: ${(error as Error).message}`);
  }
}

/**
 * Retrieve and decrypt data from Chrome storage
 *
 * @param storageKey - The key to retrieve the data from
 * @param key - The CryptoKey to use for decryption (must match the key used for encryption)
 * @param options - Options for retrieval (area: 'local' or 'sync')
 * @returns Promise that resolves to the decrypted string or null if not found
 * @throws Error if decryption fails (wrong key or corrupted data)
 *
 * @example
 * ```typescript
 * const { key } = await deriveKeyFromPassword('user-password', storedSalt);
 * const data = await getEncrypted('myData', key);
 * ```
 */
export async function getEncrypted(
  storageKey: string,
  key: CryptoKey,
  options: SecureStorageOptions = {},
): Promise<string | null> {
  const { area = 'local' } = options;

  return new Promise((resolve, reject) => {
    chrome.storage[area].get([storageKey], (result: StorageResult) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      const handleDecryption = async (): Promise<void> => {
        try {
          if (result[storageKey] == null) {
            resolve(null);
            return;
          }

          const storedData = result[storageKey] as StoredEncryptedData;
          const { encryptedData, iv } = storedData;
          const decrypted = await decryptData(encryptedData, iv, key);
          resolve(decrypted);
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Failed to decrypt data'));
        }
      };

      handleDecryption().catch(reject);
    });
  });
}

/**
 * Check if encrypted data exists in storage
 *
 * @param storageKey - The key to check
 * @param options - Options for checking (area: 'local' or 'sync')
 * @returns Promise that resolves to true if the key exists
 *
 * @example
 * ```typescript
 * const exists = await hasEncrypted('myData');
 * if (exists) {
 *   const data = await getEncrypted('myData', key);
 * }
 * ```
 */
export async function hasEncrypted(
  storageKey: string,
  options: SecureStorageOptions = {},
): Promise<boolean> {
  const { area = 'local' } = options;

  return new Promise((resolve) => {
    chrome.storage[area].get([storageKey], (result: StorageResult) => {
      resolve(Boolean(result[storageKey] != null));
    });
  });
}

/**
 * Remove encrypted data from storage
 *
 * @param storageKey - The key to remove
 * @param options - Options for removal (area: 'local' or 'sync')
 * @returns Promise that resolves when removal is complete
 *
 * @example
 * ```typescript
 * await removeEncrypted('myData');
 * ```
 */
export async function removeEncrypted(
  storageKey: string,
  options: SecureStorageOptions = {},
): Promise<void> {
  const { area = 'local' } = options;

  return new Promise((resolve, reject) => {
    chrome.storage[area].remove([storageKey], () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}
