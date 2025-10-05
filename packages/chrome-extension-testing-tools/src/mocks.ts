// tests/setup.ts
import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onMessageExternal: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    lastError: null as any,
  },
  tabs: {
    sendMessage: vi.fn(),
  },
  windows: {
    getCurrent: vi.fn(),
  },
};

// Mock browser APIs (Firefox)
const mockBrowser = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onMessageExternal: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    lastError: null as any,
  },
  tabs: {
    sendMessage: vi.fn(),
  },
  windows: {
    getCurrent: vi.fn(),
  },
};

(globalThis as any).chrome = mockChrome;

(globalThis as any).browser = mockBrowser;

export { mockBrowser, mockChrome };
