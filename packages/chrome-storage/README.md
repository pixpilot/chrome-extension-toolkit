# Chrome Storage

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
npm install @pixpilot/chrome-storage
```

## Quick Start

### Basic Usage (Type-Safe Storage)

```typescript
import { ChromeStorage } from '@pixpilot/chrome-storage';

const storage = new ChromeStorage();

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

### Type-Safe Storage Schema

Define a schema for **fully type-safe** keys and values - TypeScript will prevent you from using invalid keys:

```typescript
import { ChromeStorage } from '@pixpilot/chrome-storage';

// Define your storage schema (use type or interface)
interface MyStorageSchema {
  username: string;
  userAge: number;
  settings: { theme: string; notifications: boolean };
}

// Or use a type
interface MyStorageSchema {
  username: string;
  userAge: number;
  settings: { theme: string; notifications: boolean };
}

// Create storage with schema
const storage = new ChromeStorage<MyStorageSchema>();

// Now your keys and values are fully type-safe!
await storage.set('username', 'john_doe'); // ✓ Valid
await storage.set('userAge', 25); // ✓ Valid
await storage.set('username', 123); // ✗ TypeScript error: Type 'number' is not assignable to type 'string'

// Invalid keys are caught at compile time
await storage.set('invalidKey', 'value'); // ✗ TypeScript error: Argument of type '"invalidKey"' is not assignable
await storage.set('userAge', 'not-a-number'); // ✗ TypeScript error: Type 'string' is not assignable to type 'number'

// Type-safe retrieval with auto-complete
const username = await storage.get('username'); // Type: string | undefined
const age = await storage.get('userAge'); // Type: number | undefined
const settings = await storage.get('settings'); // Type: { theme: string; notifications: boolean } | undefined

// All methods enforce schema keys
await storage.remove('username'); // ✓ Valid
await storage.remove('invalidKey'); // ✗ TypeScript error

// getMultiple returns correctly typed partial object
const data = await storage.getMultiple(['username', 'userAge']);
// Type: Partial<Pick<MyStorageSchema, 'username' | 'userAge'>>
// data.username is string | undefined
// data.userAge is number | undefined

// getAll returns all schema keys
const all = await storage.getAll();
// Type: Partial<MyStorageSchema>
```

### One-Time Data (getOnce)

Get data and immediately remove it - useful for temporary tokens, one-time codes, or message passing:

```typescript
// Without schema - allows any string key
const storage = new ChromeStorage();

// Store one-time token
await storage.set('oneTimeToken', 'abc123');

// Get and remove in one operation
const token = await storage.getOnce('oneTimeToken');
console.log(token); // 'abc123'

// Token is now removed
const tokenAfter = await storage.get('oneTimeToken');
console.log(tokenAfter); // undefined

// With type-safe schema
interface MyStorage {
  oneTimeCode: string;
  tempSession: { userId: number; expires: number };
}

const typedStorage = new ChromeStorage<MyStorage>();
await typedStorage.set('oneTimeCode', 'CODE123');
const code = await typedStorage.getOnce('oneTimeCode'); // Type: string | undefined
// typedStorage.getOnce('invalidKey'); // ✗ TypeScript error

// Works with complex data
const session = { userId: 123, expires: Date.now() + 3600000 };
await typedStorage.set('tempSession', session);
const retrievedSession = await typedStorage.getOnce('tempSession');
// Type: { userId: number; expires: number } | undefined
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
const storage = new ChromeStorage();

// Store in sync storage instead of local
await storage.set('theme', 'dark', { area: 'sync' });
const theme = await storage.get<string>('theme', { area: 'sync' });
```

### Key Transformation for Namespacing

```typescript
const storage = new ChromeStorage({
  keyTransformer: (key) => `myapp_${key}`,
});

// Internally stored as "myapp_setting"
await storage.set('setting', 'value');
```

### Convenience API

```typescript
import { ChromeStorage, createStorageAPI } from '@pixpilot/chrome-storage';

const manager = new ChromeStorage();
const storage = createStorageAPI(manager);

// Cleaner API without manager reference
await storage.set('key', 'value');
const value = await storage.get('key');
await storage.remove('key');
```

### Watching for Changes

Listen to changes for specific storage keys using the `watch` method:

```typescript
import { ChromeStorage } from '@pixpilot/chrome-storage';

// Define your storage schema
interface MyStorage {
  username: string;
  settings: { theme: string; notifications: boolean };
  count: number;
}

const storage = new ChromeStorage<MyStorage>();

// Watch for changes to a specific key
const unsubscribe = storage.watch('username', (change, key, area) => {
  console.log(`${key} changed in ${area} storage`);
  console.log('Old value:', change.oldValue);
  console.log('New value:', change.newValue);
});

// Later, stop watching
unsubscribe();
```

#### Watch with Storage Area Filter

```typescript
// Only listen to changes in local storage
const unsubscribe = storage.watch(
  'settings',
  (change) => {
    console.log('Settings updated:', change.newValue);
  },
  { area: 'local' },
);

// This will only trigger for local storage changes, not sync storage
```

#### Multiple Listeners

```typescript
// You can add multiple listeners for the same key
const unsubscribe1 = storage.watch('username', (change) => {
  console.log('Listener 1:', change.newValue);
});

const unsubscribe2 = storage.watch('username', (change) => {
  console.log('Listener 2:', change.newValue);
});

// Both listeners will be called when username changes

// Remove listeners independently
unsubscribe1();
// unsubscribe2 still active
```

#### React Hook Example

```tsx
import { useEffect, useState } from 'react';

function useStorageValue<T>(
  storage: ChromeStorage<MyStorage>,
  key: keyof MyStorage,
): T | undefined {
  const [value, setValue] = useState<T | undefined>();

  useEffect(() => {
    // Get initial value
    storage.get(key).then((initialValue) => {
      setValue(initialValue as T | undefined);
    });

    // Watch for changes
    const unsubscribe = storage.watch(key, (change) => {
      setValue(change.newValue as T | undefined);
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, [storage, key]);

  return value;
}

// Usage
function MyComponent() {
  const username = useStorageValue<string>(storage, 'username');

  return <div>Username: {username}</div>;
}
```

#### Handling Different Change Types

```typescript
storage.watch('username', (change, key, area) => {
  if (change.oldValue === undefined) {
    console.log('Item created:', change.newValue);
  } else if (change.newValue === undefined) {
    console.log('Item deleted:', change.oldValue);
  } else {
    console.log('Item updated:', change.oldValue, '->', change.newValue);
  }
});
```

#### Using with Key Transformer

The `watch` method respects the `keyTransformer` option:

```typescript
const storage = new ChromeStorage({
  keyTransformer: (key) => `myapp_${key}`,
});

// Watches for changes to "myapp_username" in storage
storage.watch('username', (change) => {
  console.log('Username changed:', change.newValue);
});
```

**Note:** The callback receives the transformed key, not the original key.

## API Reference

### ChromeStorage Class

#### Constructor

```typescript
// Constructor signature
// new ChromeStorage<TSchema>(options?: GenericChromeStorageOptions)
```

Generic Parameters:

- `TSchema?` - Optional schema type (interface or type) for **fully type-safe** keys and values. When provided, only keys from the schema are allowed (compile-time enforcement). Do not use `extends Record<string, unknown>` as it defeats the type safety.

Options:

- `keyTransformer?: (key: string) => string` - Transform keys (e.g., add prefix for namespacing)
- `encryptionProvider?: EncryptionProvider | null` - Optional encryption provider (see Advanced Usage)

#### Methods

All methods throw errors on failure. Use try-catch for error handling. When using a schema, all methods enforce type-safe keys at compile time.

- `get<K>(key: K, options?)` - Get a single item. Returns `TSchema[K] | undefined`. Key must be from schema.
- `getOnce<K>(key: K, options?)` - Get and remove a single item. Returns `TSchema[K] | undefined`. Key must be from schema.
- `getMultiple<K>(keys: K[], options?)` - Get multiple items. Returns `Partial<Pick<TSchema, K>>`. Keys must be from schema.
- `getAll(options?)` - Get all items from storage. Returns `Partial<TSchema>`.
- `set<K>(key: K, value: TSchema[K], options?)` - Set a single item. Key and value type must match schema.
- `setMultiple<K>(items: Partial<Pick<TSchema, K>>, options?)` - Set multiple items. Keys and values must match schema.
- `remove(keys: keyof TSchema | (keyof TSchema)[], options?)` - Remove item(s). Keys must be from schema.
- `clear(options?)` - Clear all items from storage area
- `has(key: keyof TSchema | string, options?)` - Check if key exists (allows any string for flexibility)
- `getBytesInUse(keys?: keyof TSchema | (keyof TSchema)[], options?)` - Get storage usage in bytes
- `watch<K>(key: K, callback: StorageChangeCallback<TSchema[K]>, options?)` - Watch for changes to a specific key. Returns an unsubscribe function. Options can include `area` to filter by storage area ('local' or 'sync').

#### Storage Change Callback

```typescript
type StorageChangeCallback<T> = (
  change: StorageChange<T>,
  key: string,
  area: 'local' | 'sync',
) => void;

interface StorageChange<T> {
  oldValue?: T; // undefined if item was just created
  newValue?: T; // undefined if item was just deleted
}
```

#### Storage Options

```typescript
interface StorageOptions {
  area?: 'local' | 'sync'; // Storage area (default: 'local')
  encrypted?: boolean; // Use encryption (default: false, requires encryptionProvider)
}
```

**Note:** All methods throw errors on failure instead of returning success/error objects.

## Advanced Usage: Encryption

For sensitive data, ChromeStorage supports optional AES-GCM encryption with user-provided keys.

### ⚠️ Security Notice

**IMPORTANT:** Encryption requires you to provide your own keys. Keys are **NEVER stored** in chrome.storage. This ensures that even if someone gains access to the extension's storage, they cannot decrypt the data without the key.

### Secure Storage with Password-Derived Keys

```typescript
import { ChromeStorage } from '@pixpilot/chrome-storage';
import { DefaultEncryptionProvider } from '@pixpilot/chrome-storage/default-encryption-provider';
import { deriveKeyFromPassword } from '@pixpilot/chrome-storage/secure-storage';

// First time: Derive key from user password
const { key, salt } = await deriveKeyFromPassword('user-password');

// Store the salt (it's safe to store, needed for key re-derivation)
await chrome.storage.local.set({ userSalt: salt });

// Create encryption provider with the key
const encryptionProvider = new DefaultEncryptionProvider({ key });

// Create storage manager with encryption
const storage = new ChromeStorage({ encryptionProvider });

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
} from '@pixpilot/chrome-storage/secure-storage';

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
import type { EncryptionProvider } from '@pixpilot/chrome-storage';
import { ChromeStorage } from '@pixpilot/chrome-storage';

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

const storage = new ChromeStorage({
  encryptionProvider: new CustomEncryption(),
});
```

### Disable Encryption

```typescript
// Explicitly disable encryption
const storage = new ChromeStorage({
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
