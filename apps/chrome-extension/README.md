# Chrome Extension Template

> Modern Chrome extension template built with Vite + React + TypeScript + Tailwind CSS v4

## Features

- ⚡ Vite for fast development and building
- ⚛️ React 19 with TypeScript
- 🎨 Tailwind CSS v4 with custom theme
- 📦 Manifest V3 support
- 🔧 ESLint & Prettier configured
- 🚀 Hot module replacement in development

## Getting Started

1. Use this template or clone the repository
2. Install dependencies: `pnpm install`
3. Configure your extension in `src/manifest.ts`
4. Start developing: `pnpm dev`

## Development

```bash
pnpm dev
```

Load the extension in Chrome:

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `build` folder

## Building

```bash
pnpm build
```

The `build` folder will contain your extension ready for distribution.

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm typecheck` - Run TypeScript type checking
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint issues
- `pnpm format` - Check code formatting
- `pnpm format:fix` - Fix code formatting

## Acknowledgments

This template is based on [create-chrome-ext](https://github.com/guocaoyi/create-chrome-ext) by [@guocaoyi](https://github.com/guocaoyi). Enhanced with Tailwind CSS v4 and additional development tools.
