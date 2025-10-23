# Chrome Storage Plus

A powerful and type-safe Chrome Storage API wrapper with optional built-in encryption support for Chrome extensions.

## Features

- 🎯 **Type-Safe**: Full TypeScript support with generics for strongly-typed storage
- 📦 **Simple API**: Intuitive methods for get, set, remove, and more
- 🔄 **Flexible**: Support for both local and sync storage areas
- 🔒 **Optional Encryption**: Secure AES-GCM encryption when you need it
- 🧪 **Well Tested**: Comprehensive test coverage
- ⚡ **Easy to Use**: Minimal setup for basic usage

## Installation

```bash
npm install @pixpilot/chrome-storage-plus
```

## Quick Start

### Basic Usage (Type-Safe Storage)

```typescript
import { ChromeStoragePlus } from '@pixpilot/chrome-storage-plus';

const storage = new ChromeStoragePlus();

// Store typed data
await storage.set('username', 'john_doe');
await storage.set('settings', { theme: 'dark', notifications: true });
const initialCount = 42;
await storage.set('count', initialCount);

// Retrieve typed data
const username = await storage.get<string>('username');
const settings = await storage.get<{ theme: string; notifications: boolean }>('settings');
const count = await storage.get<number>('count');

console.log(username); // 'john_doe'
console.log(settings?.theme); // 'dark'

// Check if data exists
const hasKey = await storage.has('username');
console.log(hasKey); // true

// Remove data
await storage.remove('username');

// Set multiple items at once
await storage.setMultiple({
  name: 'John',
  age: 30,
  email: 'john@example.com',
});

// Get multiple items
const result = await storage.getMultiple<string>(['name', 'email']);
console.log(result); // { name: 'John', email: 'john@example.com' }

// Get all items
const all = await storage.getAll();
console.log(all);

// Clear all storage
await storage.clear();
```

### Error Handling

All methods throw errors on failure - use try-catch for error handling:

```typescript
try {
  await storage.set('key', 'value');
  const value = await storage.get('key');
  console.log('Data:', value);
} catch (error) {
  console.error('Storage error:', error.message);
}
```

### Using Sync Storage

```typescript
const storage = new ChromeStoragePlus();

// Store in sync storage instead of local
await storage.set('theme', 'dark', { area: 'sync' });
const theme = await storage.get<string>('theme', { area: 'sync' });
```

### Key Transformation for Namespacing

```typescript
const storage = new ChromeStoragePlus({
  keyTransformer: (key) => `myapp_${key}`,
});

// Internally stored as "myapp_setting"
await storage.set('setting', 'value');
```

### Convenience API

```typescript
import { ChromeStoragePlus, createStorageAPI } from '@pixpilot/chrome-storage-plus';

const manager = new ChromeStoragePlus();
const storage = createStorageAPI(manager);

// Cleaner API without manager reference
await storage.set('key', 'value');
const value = await storage.get('key');
await storage.remove('key');
```

## API Reference

### ChromeStoragePlus Class

#### Constructor

```typescript
// Constructor signature
// new ChromeStoragePlus(options?: GenericChromeStorageOptions)
```

Options:

- `keyTransformer?: (key: string) => string` - Transform keys (e.g., add prefix for namespacing)
- `encryptionProvider?: EncryptionProvider | null` - Optional encryption provider (see Advanced Usage)

#### Methods

All methods throw errors on failure. Use try-catch for error handling.

- `get<T>(key: string, options?)` - Get a single item (returns T | undefined)
- `getMultiple<T>(keys: string[], options?)` - Get multiple items
- `getAll<T>(options?)` - Get all items from storage
- `set<T>(key: string, value: T, options?)` - Set a single item
- `setMultiple<T>(items: Record<string, T>, options?)` - Set multiple items
- `remove(keys: string | string[], options?)` - Remove item(s)
- `clear(options?)` - Clear all items from storage area
- `has(key: string, options?)` - Check if key exists (returns boolean)
- `getBytesInUse(keys?, options?)` - Get storage usage in bytes (returns number)

#### Storage Options

```typescript
interface StorageOptions {
  area?: 'local' | 'sync'; // Storage area (default: 'local')
  encrypted?: boolean; // Use encryption (default: false, requires encryptionProvider)
}
```

**Note:** All methods throw errors on failure instead of returning success/error objects.

## Advanced Usage: Encryption

For sensitive data, ChromeStoragePlus supports optional AES-GCM encryption with user-provided keys.

### ⚠️ Security Notice

**IMPORTANT:** Encryption requires you to provide your own keys. Keys are **NEVER stored** in chrome.storage. This ensures that even if someone gains access to the extension's storage, they cannot decrypt the data without the key.

### Secure Storage with Password-Derived Keys

```typescript
import { ChromeStoragePlus } from '@pixpilot/chrome-storage-plus';
import { DefaultEncryptionProvider } from '@pixpilot/chrome-storage-plus/default-encryption-provider';
import { deriveKeyFromPassword } from '@pixpilot/chrome-storage-plus/secure-storage';

// First time: Derive key from user password
const { key, salt } = await deriveKeyFromPassword('user-password');

// Store the salt (it's safe to store, needed for key re-derivation)
await chrome.storage.local.set({ userSalt: salt });

// Create encryption provider with the key
const encryptionProvider = new DefaultEncryptionProvider({ key });

// Create storage manager with encryption
const storage = new ChromeStoragePlus({ encryptionProvider });

// Store encrypted data (automatically serialized)
await storage.set('apiKey', 'secret-key-123', { encrypted: true });
await storage.set('credentials', { user: 'admin', pass: 'secret' }, { encrypted: true });

// Retrieve encrypted data (automatically deserialized)
const apiKey = await storage.get<string>('apiKey', { encrypted: true });
const credentials = await storage.get<{ user: string; pass: string }>('credentials', {
  encrypted: true,
});
console.log(apiKey); // 'secret-key-123'

// Later: Re-derive key from password
const storedData = await chrome.storage.local.get('userSalt');
const { key: derivedKey } = await deriveKeyFromPassword(
  'user-password',
  storedData.userSalt,
);
```

### Low-Level Encryption Utilities

For direct encryption/decryption without the storage manager:

```typescript
import {
  deriveKeyFromPassword,
  getEncrypted,
  hasEncrypted,
  removeEncrypted,
  storeEncrypted,
} from '@pixpilot/chrome-storage-plus/secure-storage';

// Derive key from password
const { key, salt } = await deriveKeyFromPassword('user-password');
await chrome.storage.local.set({ userSalt: salt });

// Store encrypted data (string only for low-level API)
await storeEncrypted('myKey', 'sensitive data', key, { area: 'local' });

// Retrieve encrypted data
const data = await getEncrypted('myKey', key);

// Check if encrypted data exists
const exists = await hasEncrypted('myKey');

// Remove encrypted data
await removeEncrypted('myKey');
```

### Custom Encryption Provider

```typescript
import type { EncryptionProvider } from '@pixpilot/chrome-storage-plus';
import { ChromeStoragePlus } from '@pixpilot/chrome-storage-plus';

// Implement custom encryption logic
class CustomEncryption implements EncryptionProvider {
  async encrypt(key: string, value: string): Promise<void> {
    // Your encryption logic
  }

  async decrypt(key: string): Promise<string | null> {
    // Your decryption logic
  }

  async remove(key: string): Promise<void> {
    // Cleanup logic
  }

  async has(key: string): Promise<boolean> {
    // Check existence
  }
}

const storage = new ChromeStoragePlus({
  encryptionProvider: new CustomEncryption(),
});
```

### Disable Encryption

```typescript
// Explicitly disable encryption
const storage = new ChromeStoragePlus({
  encryptionProvider: null,
});

// This will now throw an error
try {
  await storage.set('data', 'value', { encrypted: true });
} catch (error) {
  console.error(error.message); // 'Encryption provider not configured'
}
```

## 🔐 Security Best Practices (When Using Encryption)

### 1. Never Store Encryption Keys

**❌ DON'T DO THIS:**

```typescript
// WRONG: Storing key defeats the purpose of encryption
const key = await generateEncryptionKey();
const exportedKey = await crypto.subtle.exportKey('raw', key);
await chrome.storage.local.set({ myKey: Array.from(new Uint8Array(exportedKey)) });
```

**✅ DO THIS:**

```typescript
// CORRECT: Derive key from user password, store only the salt
const { key, salt } = await deriveKeyFromPassword('user-password');
await chrome.storage.local.set({ salt }); // Salt is safe to store
// Use key for encryption/decryption, then let it be garbage collected
```

### 2. Use Strong Passwords

```typescript
// Enforce minimum password requirements
function isStrongPassword(password: string): boolean {
  const MIN_PASSWORD_LENGTH = 12;
  return (
    password.length >= MIN_PASSWORD_LENGTH &&
    /[A-Z]/u.test(password) &&
    /[a-z]/u.test(password) &&
    /\d/u.test(password) &&
    /[^A-Z0-9]/iu.test(password)
  );
}

const password = await promptUserForPassword();
if (!isStrongPassword(password)) {
  throw new Error('Password does not meet minimum requirements');
}

const { key, salt } = await deriveKeyFromPassword(password);
```

### 3. Handle Decryption Failures Gracefully

```typescript
try {
  const data = await storage.get('myData', { encrypted: true });
  if (data === undefined) {
    // Data doesn't exist
    console.log('No data found');
  } else {
    // Data decrypted successfully
    console.log('Data:', data);
  }
} catch (error) {
  // Wrong key or corrupted data
  console.error('Decryption failed:', error.message);
  // Prompt user to re-enter password or reset data
}
```

## Encryption Technical Details

When encryption is enabled:

- **Algorithm**: AES-GCM 256-bit encryption via Web Crypto API
- **Key Derivation**: PBKDF2 with 210,000 iterations (OWASP 2025 minimum), SHA-256
- **Unique IVs**: Each encrypted value has its own initialization vector
- **Data Integrity**: AES-GCM provides built-in authentication
- **Serialization**: Automatic JSON serialization/deserialization for type safety

## Testing

The package includes comprehensive tests. Run them with:

```bash
npm test
```

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines first.
