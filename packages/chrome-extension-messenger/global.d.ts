/// <reference types="vite/client" />
/// <reference types="chrome" />

// eslint-disable-next-line no-underscore-dangle
declare const __APP_VERSION__: string;
// eslint-disable-next-line no-underscore-dangle
declare const __DEV__: boolean;

declare global {
  // eslint-disable-next-line vars-on-top
  var browser: typeof chrome;
}

declare global {
  interface GlobalThis {
    browser?: typeof chrome;
  }
}

export {};
