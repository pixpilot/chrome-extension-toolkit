# @internal/utils

TypeScript utility functions for formatting, validation, and date operations.

## 🔧 Functions

### Text & Number Formatting

```tsx
import { formatCurrency, slugify, toTitleCase, truncateText } from '@internal/utils';

toTitleCase('hello world'); // → 'Hello World'
formatCurrency(price); // → '$1,234.56'
truncateText('Long text here...', maxLength); // → 'Long text...'
slugify('Hello World!'); // → 'hello-world'
```

### Validation

```tsx
import { isEmpty, isValidEmail, isValidPhone, isValidUrl } from '@internal/utils';

isValidEmail('user@example.com'); // → true
isValidUrl('https://example.com'); // → true
isEmpty('   '); // → true
isValidPhone('+1234567890'); // → true
```

### Date Utilities

```tsx
import { formatDate, getRelativeTime, isToday } from '@internal/utils';

formatDate(new Date()); // → 'January 1, 2024'
getRelativeTime(yesterday); // → '1 day ago'
isToday(new Date()); // → true
```

## 🚀 Usage

Import utilities in your components:

```tsx
import { formatCurrency, formatDate, isValidEmail } from '@internal/utils';

export function UserProfile({ price, email, createdAt }) {
  return (
    <div>
      <p>Price: {formatCurrency(price)}</p>
      <p>Email: {isValidEmail(email) ? '✅ Valid' : '❌ Invalid'}</p>
      <p>Created: {formatDate(createdAt)}</p>
    </div>
  );
}
```

## 🛠️ Development

```bash
pnpm build      # Build utilities
pnpm typecheck  # Type checking
```

## Usage

This package is meant to be used internally within the monorepo:

```tsx
import { formatDate, isValidEmail } from '@internal/utils';
```
