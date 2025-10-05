/**
 * Tests for createMessageState
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMessageState } from '../src/react';

// Mock chrome runtime
const mockChrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    sendMessage: vi.fn(),
    lastError: null,
  },
  tabs: {
    sendMessage: vi.fn(),
  },
};

// @ts-expect-error - Mocking global chrome object
globalThis.chrome = mockChrome;

describe('createMessageState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create sender and hook functions', () => {
    const { send: sender, useMessage: useHook } = createMessageState<{ message: string }>(
      'TEST_MESSAGE',
    );

    expect(typeof sender).toBe('function');
    expect(typeof useHook).toBe('function');
  });

  it('should send message via runtime.sendMessage', async () => {
    const { send: sendTestMessage } = createMessageState<{ message: string }>(
      'TEST_MESSAGE',
    );

    mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
      expect(message.identifier).toBe('TEST_MESSAGE');
      callback && callback('response');
    });

    const testData = { message: 'test' };
    const promise = sendTestMessage(testData);

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
      { identifier: 'TEST_MESSAGE', data: testData },
      expect.any(Function),
    );

    // Verify it returns a promise-like object
    expect(promise).toBeDefined();
  });

  it('should send message to specific tab when tabId provided', async () => {
    const { send: sendTestMessage } = createMessageState<{ message: string }>(
      'TEST_MESSAGE',
    );

    mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      expect(tabId).toBe(123);
      expect(message.identifier).toBe('TEST_MESSAGE');
      callback && callback('response');
    });

    const testData = { message: 'test' };
    await sendTestMessage(testData, { tabId: 123 });

    expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
      123,
      { identifier: 'TEST_MESSAGE', data: testData, options: { tabId: 123 } },
      expect.any(Function),
    );
  });

  it('should send message to external extension when extensionId provided', async () => {
    const { send: sendTestMessage } = createMessageState<{ message: string }>(
      'TEST_MESSAGE',
    );

    mockChrome.runtime.sendMessage.mockImplementation(
      (extensionId, message, callback) => {
        expect(extensionId).toBe('test-extension-id');
        expect(message.identifier).toBe('TEST_MESSAGE');
        callback && callback('response');
      },
    );

    const testData = { message: 'test' };
    await sendTestMessage(testData, { extensionId: 'test-extension-id' });

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
      'test-extension-id',
      {
        identifier: 'TEST_MESSAGE',
        data: testData,
        options: { extensionId: 'test-extension-id' },
      },
      expect.any(Function),
    );
  });

  describe('useMessage hook', () => {
    it('should initialize with default value', () => {
      const { useMessage } = createMessageState<string>('TEST_MESSAGE');
      const { result } = renderHook(() => useMessage('default'));

      expect(result.current[0]).toBe('default');
    });

    it('should provide stateUtils with setState and clearState', () => {
      const { useMessage } = createMessageState<string>('TEST_MESSAGE');
      const { result } = renderHook(() => useMessage('default'));

      const [, stateUtils] = result.current;

      expect(typeof stateUtils.setState).toBe('function');
      expect(typeof stateUtils.clearState).toBe('function');
    });

    it('should update state when setState is called', () => {
      const { useMessage } = createMessageState<string>('TEST_MESSAGE');
      const { result } = renderHook(() => useMessage('default'));

      const [, stateUtils] = result.current;

      act(() => {
        stateUtils.setState('new state');
      });

      expect(result.current[0]).toBe('new state');
    });

    it('should clear state to default value when clearState is called', () => {
      const { useMessage } = createMessageState<string>('TEST_MESSAGE');
      const { result } = renderHook(() => useMessage('default'));

      const [, stateUtils] = result.current;

      act(() => {
        stateUtils.setState('new state');
      });

      expect(result.current[0]).toBe('new state');

      act(() => {
        stateUtils.clearState();
      });

      expect(result.current[0]).toBe('default');
    });

    it('should clear state to undefined when no default value provided', () => {
      const { useMessage } = createMessageState<string>('TEST_MESSAGE');
      const { result } = renderHook(() => useMessage());

      const [, stateUtils] = result.current;

      act(() => {
        stateUtils.setState('new state');
      });

      expect(result.current[0]).toBe('new state');

      act(() => {
        stateUtils.clearState();
      });

      expect(result.current[0]).toBeUndefined();
    });
  });
});
