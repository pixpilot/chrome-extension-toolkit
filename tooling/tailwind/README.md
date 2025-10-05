# @internal/tailwind

Shared Tailwind CSS configuration and globals for the Electron monorepo.

## Overview

This package provides a centralized Tailwind CSS configuration that can be used across all windows in the Electron application. It includes:

- Tailwind v4 configuration with CSS imports
- Consistent theme definitions (light/dark mode)
- Custom variants and utilities
- Shared global styles

## Usage

### Basic Usage

Import the shared globals in your window's main entry file:

```tsx
// src/main.tsx
import '@internal/tailwind/globals.css';
```

This gives you access to all the default Tailwind utilities plus the custom theme variables.

### Window-Specific Styles

If you need window-specific styles, create a separate CSS file and import it after the globals:

```tsx
// src/main.tsx
import '@internal/tailwind/globals.css';
import './window-specific.css'; // Your custom styles
```

### Theme Configuration

The package exports theme configuration that you can use in TypeScript:

```tsx
import { themeConfig } from '@internal/tailwind';

// Access theme colors
const backgroundColor = themeConfig.colors.light.background;
```

## Features

### Tailwind v4 Support

- Uses `@import 'tailwindcss'` for modern Tailwind v4
- No config.js file needed
- CSS-first approach

### Theme System

- Light and dark mode support
- CSS custom properties for easy theming
- Consistent color palette across all windows

### Custom Variants

- Dark mode variant: `@custom-variant dark (&:where(.dark, .dark *))`
- Automatic theme switching based on `.dark` class

## File Structure

```
tooling/tailwind/
├── src/
│   ├── globals.css    # Main Tailwind CSS file
│   ├── index.ts       # Package exports
│   └── main.ts        # Theme configuration and utilities
└── package.json       # Package configuration
```

## Adding New Windows

When creating new windows:

1. Add `"@internal/tailwind": "workspace:*"` to dependencies
2. Import `@internal/tailwind/globals.css` in your main.tsx
3. Remove any local globals.css files

## Customization

To modify the shared theme:

1. Edit `src/globals.css` for CSS changes
2. Update `src/main.ts` for TypeScript theme configuration
3. All windows will automatically use the updated theme

## Best Practices

- Keep window-specific styles minimal
- Use the shared theme variables for consistency
- Prefer extending the shared styles over duplicating them
- Test changes across all windows
