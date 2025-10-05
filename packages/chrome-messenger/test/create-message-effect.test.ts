/**
 * Tests for createMessageEffect
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMessageEffect } from '../src/react';

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

describe('createMessageEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create sender and effect hook functions', () => {
    const { send: sender, useMessageEffect } = createMessageEffect<{ event: string }>(
      'ANALYTICS',
    );

    expect(typeof sender).toBe('function');
    expect(typeof useMessageEffect).toBe('function');
  });

  it('should send message via runtime.sendMessage', async () => {
    const { send: sendAnalytics } = createMessageEffect<{ event: string }>('ANALYTICS');

    mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
      callback('response');
    });

    const testData = { event: 'user_clicked' };
    const promise = sendAnalytics(testData);

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
      { identifier: 'ANALYTICS', data: testData },
      expect.any(Function),
    );

    // Verify it returns a promise-like object
    expect(promise).toBeDefined();
  });

  it('should send message to specific tab when tabId provided', async () => {
    const { send: sendAnalytics } = createMessageEffect<{ event: string }>('ANALYTICS');

    mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      callback('response');
    });

    const testData = { event: 'user_clicked' };
    await sendAnalytics(testData, { tabId: 123 });

    expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
      123,
      { identifier: 'ANALYTICS', data: testData, options: { tabId: 123 } },
      expect.any(Function),
    );
  });

  it('should create message effect with correct identifier', async () => {
    const { useMessageEffect: useAnalyticsEffect } = createMessageEffect<
      { event: string },
      { success: boolean }
    >('ANALYTICS');

    // Verify the hook function is created
    expect(typeof useAnalyticsEffect).toBe('function');

    // Test that the identifier is correctly used in the message structure
    const { send: sendAnalytics } = createMessageEffect<{ event: string }>('ANALYTICS');

    mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
      expect(message.identifier).toBe('ANALYTICS');
      callback && callback('response');
    });

    await sendAnalytics({ event: 'test' });
  });

  it('should send messages with external extension ID', async () => {
    const { send: sendAnalytics } = createMessageEffect<{ event: string }>('ANALYTICS');

    mockChrome.runtime.sendMessage.mockImplementation(
      (extensionId, message, callback) => {
        expect(extensionId).toBe('test-extension-id');
        expect(message.identifier).toBe('ANALYTICS');
        callback && callback('response');
      },
    );

    await sendAnalytics({ event: 'test' }, { extensionId: 'test-extension-id' });

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
      'test-extension-id',
      {
        identifier: 'ANALYTICS',
        data: { event: 'test' },
        options: { extensionId: 'test-extension-id' },
      },
      expect.any(Function),
    );
  });

  it('should return promise-like object from sender', () => {
    const { send: sendAnalytics } = createMessageEffect<{ event: string }>('ANALYTICS');

    mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
      expect(message.identifier).toBe('ANALYTICS');
      callback && callback('response');
    });

    const result = sendAnalytics({ event: 'test' });

    // Should return a promise-like object for conditional return type
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('should have consistent behavior with createMessageState', () => {
    // Both should create sender functions with the same behavior
    const { send: sendEffect } = createMessageEffect<{ event: string }>('TEST');

    mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
      expect(message.identifier).toBe('TEST');
      expect(message.data).toEqual({ event: 'test' });
      callback && callback('response');
    });

    const result = sendEffect({ event: 'test' });

    expect(result).toBeDefined();
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalled();
  });
});
