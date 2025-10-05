// import { fileURLToPath } from 'node:url';
import prettierConfig from '@pixpilot/dev-config/prettier';

/** @typedef {import("prettier").Config} PrettierConfig */
/** @typedef {import("prettier-plugin-tailwindcss").PluginOptions} TailwindConfig */

/** @type { PrettierConfig  | TailwindConfig } */
const config = {
  ...prettierConfig,
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindFunctions: ['cn', 'cva'],
  overrides: [
    ...prettierConfig.overrides,
    {
      files: '*.js.hbs',
      options: {
        parser: 'babel',
      },
    },
  ],
};

export default config;
