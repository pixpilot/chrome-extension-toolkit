/*
 * This config file exists to prevent the VS Code ESLint extension
 * from searching for an ESLint config in the root folder.
 */

import config from './tooling/eslint/base.mjs';

/** @type {import('typescript-eslint').Config} */
export default config;
