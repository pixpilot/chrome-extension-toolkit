import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import defineConfig from '@pixpilot/dev-config/vitest';

const filename = fileURLToPath(import.meta.url);
const currentDir = dirname(filename);
const setupFilePath = resolve(currentDir, 'react.setup.ts');

export default defineConfig({
  coverageOnCI: false,
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    setupFiles: [setupFilePath],
  },
});
