module.exports = {
  '*.{ts,tsx}': () => ['pnpm run typecheck'],
  '*.{ts,tsx,js,jsx,yml,yaml,json,css}': () => [
    'pnpm run lint:fix',
    'pnpm run format:fix',
  ],
};
