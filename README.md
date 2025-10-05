# Chrome Extension Monorepo Template

A template for building Chrome extensions using a monorepo structure with TypeScript, Vite, and more.

## Getting Started

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Build the extension: `pnpm build`
4. Load the extension in Chrome from the `apps/chrome-extension/build` directory

## Structure

- `apps/chrome-extension/`: The main Chrome extension app
- `packages/`: Shared packages (ui, utils, tooling)
- `tooling/`: Configuration for linting, formatting, etc.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.
