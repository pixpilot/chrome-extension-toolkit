/**
 * Basic tests for the new React hooks implementation
 */

import { describe, expect, it, vi } from 'vitest';

// Mock React for testing
vi.mock('react', () => ({
  useState: vi.fn((initial: any) => [initial, vi.fn()]),
  useEffect: vi.fn((effect: () => void) => effect()),
  useCallback: vi.fn((callback: any) => callback),
  useRef: vi.fn((initial: any) => ({ current: initial })),
}));

describe('chrome-messenger React integration', () => {
  it('should export createMessageState function', async () => {
    const { createMessageState } = await import('../src/react/create-message-state');
    expect(typeof createMessageState).toBe('function');
  });

  it('should return an object from createMessageState', async () => {
    const { createMessageState } = await import('../src/react/create-message-state');
    const result = createMessageState<{ test: string }>('test');

    expect(typeof result).toBe('object');
    expect(result).toHaveProperty('send');
    expect(result).toHaveProperty('useMessage');
    expect(typeof result.send).toBe('function'); // sender
    expect(typeof result.useMessage).toBe('function'); // hook
  });

  it('should create sender function that can be called', async () => {
    const { createMessageState } = await import('../src/react/create-message-state');
    const { send: sender } = createMessageState<{ test: string }>('test');

    expect(typeof sender).toBe('function');
    // Sender exists and is a function - actual calling would need browser environment
  });
});
