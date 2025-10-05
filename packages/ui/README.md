# @internal/ui

Shared React UI components with TypeScript and Tailwind CSS styling.

## 📦 Components

### Button

Customizable button component with multiple variants and sizes.

```tsx
import { Button } from '@internal/ui';

<Button variant="primary" size="lg">
  Click me
</Button>;
```

**Props:**

- `variant`: `'primary'` | `'secondary'` | `'outline'`
- `size`: `'sm'` | `'md'` | `'lg'`
- All standard HTML button attributes

### Card

Flexible container component for organizing content.

```tsx
import { Card } from '@internal/ui';

<Card title="Card Title" description="Card description">
  <p>Your content here</p>
</Card>;
```

**Props:**

- `title?`: Optional card title
- `description?`: Optional card description
- `className?`: Additional CSS classes
- `children`: Card content

## 🚀 Usage

Import components in your app:

```tsx
import { Button, Card } from '@internal/ui';

export function MyComponent() {
  return (
    <Card title="Welcome">
      <Button variant="primary">Get Started</Button>
    </Card>
  );
}
```

## 🛠️ Development

```bash
pnpm build      # Build components
pnpm typecheck  # Type checking
```

Components are automatically built when you run the parent monorepo scripts.
