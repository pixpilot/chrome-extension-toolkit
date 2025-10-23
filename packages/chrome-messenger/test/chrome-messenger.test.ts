import { mockBrowser, mockChrome } from '@pixpilot/chrome-testing-tools';

// tests/chrome-messenger.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createExternalMessage, createMessage } from '../src/chrome-messenger';

const TEST_TAB_ID = 123;
const TIMEOUT_SHORT = 10;
const TIMEOUT_MEDIUM = 20;

describe('chrome-messenger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;

    (globalThis as any).chrome = mockChrome;

    (globalThis as any).browser = mockBrowser;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('browser Environment Detection', () => {
    it('should use chrome when available', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ result: 'success' });
      });

      const { send } = createMessage<{ test: string }>('test');

      await send({ test: 'data' });

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalled();
    });

    it('should use browser when chrome is undefined', async () => {
      const originalChrome = globalThis.chrome;

      (globalThis as any).chrome = undefined;

      mockBrowser.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ result: 'success' });
      });

      const { send } = createMessage<{ test: string }>('test');

      await send({ test: 'data' });

      expect(mockBrowser.runtime.sendMessage).toHaveBeenCalled();

      (globalThis as any).chrome = originalChrome;
    });
  });

  describe('createMessage - Runtime Messaging', () => {
    it('should send runtime message successfully', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ result: 'success' });
      });

      const { send } = createMessage<{ test: string }, Promise<{ result: string }>>(
        'testMessage',
      );

      const result = await send({ test: 'data' });

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        { identifier: 'testMessage', data: { test: 'data' }, options: undefined },
        expect.any(Function),
      );
      expect(result).toEqual({ result: 'success' });
    });

    it('should reject when browserEnv is not defined', async () => {
      const originalChrome = globalThis.chrome;
      const originalBrowser = (globalThis as any).browser;

      (globalThis as any).chrome = undefined;

      (globalThis as any).browser = undefined;

      const { send } = createMessage<{ test: string }, Promise<{ result: string }>>(
        'test',
      );

      await expect(send({ test: 'data' })).rejects.toThrow(
        'browserEnv environment is not defined',
      );

      (globalThis as any).chrome = originalChrome;
      (globalThis as any).browser = originalBrowser;
    });

    it('should reject when runtime is not defined', async () => {
      (globalThis as any).chrome = { runtime: undefined };

      const { send } = createMessage<{ test: string }, Promise<{ result: string }>>(
        'test',
      );

      await expect(send({ test: 'data' })).rejects.toThrow(
        'browserEnv.runtime is not defined',
      );

      (globalThis as any).chrome = mockChrome;
    });

    it('should reject when chrome.runtime.lastError exists', async () => {
      const { send } = createMessage<{ test: string }, Promise<{ result: string }>>(
        'test',
      );

      mockChrome.runtime.lastError = new Error('Runtime error');
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback(null);
      });

      await expect(send({ test: 'data' })).rejects.toThrow('Runtime error');
    });
  });

  describe('createMessage - Tab Messaging', () => {
    it('should send tab message successfully', async () => {
      const { send } = createMessage<{ test: string }, Promise<{ result: string }>>(
        'testTab',
      );

      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback({ result: 'tab-success' });
      });

      const result = await send({ test: 'data' }, { tabId: TEST_TAB_ID });

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        TEST_TAB_ID,
        {
          identifier: 'testTab',
          data: { test: 'data' },
          options: { tabId: TEST_TAB_ID },
        },
        expect.any(Function),
      );
      expect(result).toEqual({ result: 'tab-success' });
    });

    it('should reject when tabs API is not available', async () => {
      const originalTabs = globalThis.chrome.tabs;

      (globalThis as any).chrome.tabs = undefined;

      const { send } = createMessage<{ test: string }, Promise<{ result: string }>>(
        'test',
      );

      await expect(send({ test: 'data' }, { tabId: TEST_TAB_ID })).rejects.toThrow(
        'browserEnv.tabs is not defined',
      );

      (globalThis as any).chrome.tabs = originalTabs;
    });

    it('should reject when tab message fails', async () => {
      const { send } = createMessage<{ test: string }, Promise<{ result: string }>>(
        'test',
      );

      mockChrome.runtime.lastError = new Error('Tab error');
      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback(null);
      });

      await expect(send({ test: 'data' }, { tabId: TEST_TAB_ID })).rejects.toEqual(
        new Error('Tab error'),
      );
    });
  });

  describe('createMessage - External Extension Messaging', () => {
    it('should send external message successfully', async () => {
      const { send } = createMessage<{ test: string }, Promise<{ result: string }>>(
        'testExternal',
      );

      mockChrome.runtime.sendMessage.mockImplementation(
        (extensionId, message, callback) => {
          callback({ result: 'external-success' });
        },
      );

      const result = await send({ test: 'data' }, { extensionId: 'ext123' });

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        'ext123',
        {
          identifier: 'testExternal',
          data: { test: 'data' },
          options: { extensionId: 'ext123' },
        },
        expect.any(Function),
      );
      expect(result).toEqual({ result: 'external-success' });
    });
  });

  describe('message Listeners', () => {
    it('should register message listener correctly', () => {
      const callback = vi.fn();
      const { onMessage: subscribe } = createMessage<
        { test: string },
        { result: string }
      >('testListener');

      subscribe(callback);

      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it('should handle incoming message with correct identifier', () => {
      const callback = vi
        .fn()
        .mockImplementation((_data, _sender) => ({ result: 'handled' }));
      const { onMessage: subscribe } = createMessage<
        { test: string },
        { result: string }
      >('testHandler');

      subscribe(callback);

      const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0]![0];
      const sendResponse = vi.fn();

      const result = listener(
        { identifier: 'testHandler', data: { test: 'incoming' } },
        { tab: { id: 1 } },
        sendResponse,
      );

      expect(callback).toHaveBeenCalledWith({ test: 'incoming' }, { tab: { id: 1 } });
      expect(result).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith({ result: 'handled' });
    });

    it('should ignore message with wrong identifier', () => {
      const callback = vi.fn();
      const { onMessage: subscribe } = createMessage<
        { test: string },
        { result: string }
      >('testHandler');

      subscribe(callback);

      const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0]![0];
      const sendResponse = vi.fn();

      const result = listener(
        { identifier: 'wrongHandler', data: { test: 'incoming' } },
        {},
        sendResponse,
      );

      expect(callback).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should ignore invalid message format', () => {
      const callback = vi.fn();
      const { onMessage: subscribe } = createMessage<
        { test: string },
        { result: string }
      >('testHandler');

      subscribe(callback);

      const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0]![0];
      const sendResponse = vi.fn();

      // Test null message
      let result = listener(null, {}, sendResponse);
      expect(result).toBeUndefined();

      // Test string message
      result = listener('invalid', {}, sendResponse);
      expect(result).toBeUndefined();

      // Test message without identifier
      result = listener({ data: 'test' }, {}, sendResponse);
      expect(result).toBeUndefined();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle async callback', async () => {
      const callback = vi.fn().mockImplementation(async (_data, _sender) => {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, TIMEOUT_SHORT);
        });
        return { result: 'async-handled' };
      });
      const { onMessage: subscribe } = createMessage<
        { test: string },
        { result: string }
      >('asyncHandler');

      subscribe(callback);

      const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0]![0];
      const sendResponse = vi.fn();

      const result = listener(
        { identifier: 'asyncHandler', data: { test: 'async' } },
        {},
        sendResponse,
      );

      expect(result).toBe(true);

      // Wait for async callback
      await new Promise<void>((resolve) => {
        setTimeout(resolve, TIMEOUT_MEDIUM);
      });
      expect(sendResponse).toHaveBeenCalledWith({ result: 'async-handled' });
    });

    it('should handle async callback errors', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const callback = vi.fn(async () => {
        throw new Error('Async error');
      });
      const { onMessage: subscribe } = createMessage<
        { test: string },
        { result: string }
      >('errorHandler');

      subscribe(callback);

      const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0]![0];
      const sendResponse = vi.fn();

      listener({ identifier: 'errorHandler', data: { test: 'error' } }, {}, sendResponse);

      // Wait for async callback
      await new Promise((resolve) => {
        setTimeout(resolve, TIMEOUT_MEDIUM);
      });
      expect(consoleError).toHaveBeenCalledWith(
        'Error in message handler for errorHandler:',
        new Error('Async error'),
      );
      expect(sendResponse).toHaveBeenCalledWith({ error: 'Async error' });

      consoleError.mockRestore();
    });

    it('should call sendResponse and return value', () => {
      const callback = (
        _data: { test: string },
        _sender: chrome.runtime.MessageSender,
      ) => ({
        result: 'test-response',
      });
      const { onMessage: subscribe } = createMessage<
        { test: string },
        { result: string }
      >('sendResponseTest');

      subscribe(callback);

      const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0]![0];
      const nativeSendResponse = vi.fn();

      listener(
        { identifier: 'sendResponseTest', data: { test: 'data' } },
        {},
        nativeSendResponse,
      );

      expect(nativeSendResponse).toHaveBeenCalledWith({ result: 'test-response' });
    });
  });

  describe('createExternalMessage', () => {
    it('should create external message functions', () => {
      const { send, onMessage: subscribe } = createExternalMessage<
        { test: string },
        { result: string }
      >('externalTest');

      expect(typeof send).toBe('function');
      expect(typeof subscribe).toBe('function');
    });

    it('should send external message', async () => {
      const { send } = createExternalMessage<
        { test: string },
        Promise<{ result: string }>
      >('external');

      mockChrome.runtime.sendMessage.mockImplementation(
        (extensionId, message, callback) => {
          callback({ result: 'external-response' });
        },
      );

      const result = await send('ext-id-123', { test: 'external-data' });

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        'ext-id-123',
        {
          identifier: 'external',
          data: { test: 'external-data' },
          options: { extensionId: 'ext-id-123' },
        },
        expect.any(Function),
      );
      expect(result).toEqual({ result: 'external-response' });
    });

    it('should register external message listener', () => {
      const callback = vi.fn();
      const { onMessage: subscribe } = createExternalMessage<
        { test: string },
        { result: string }
      >('externalListener');

      subscribe(callback);

      expect(mockChrome.runtime.onMessageExternal.addListener).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it('should handle external message correctly', () => {
      const callback = vi
        .fn()
        .mockImplementation((_data, _sender) => ({ result: 'external-handled' }));
      const { onMessage: subscribe } = createExternalMessage<
        { test: string },
        { result: string }
      >('externalHandler');

      subscribe(callback);

      const listener = mockChrome.runtime.onMessageExternal.addListener.mock.calls[0]![0];
      const sendResponse = vi.fn();

      listener(
        { identifier: 'externalHandler', data: { test: 'external-incoming' } },
        { id: 'sender-ext-id' },
        sendResponse,
      );

      expect(callback).toHaveBeenCalledWith(
        { test: 'external-incoming' },
        { id: 'sender-ext-id' },
      );
    });
  });

  describe('type Safety', () => {
    it('should maintain type safety for data and response', () => {
      interface TestData {
        name: string;
        age: number;
      }
      interface TestResponse {
        id: string;
        success: boolean;
      }

      const { send, onMessage: subscribe } = createMessage<TestData, TestResponse>(
        'typeSafe',
      );

      // This should compile without errors
      subscribe((data, _sender) => {
        // data should be TestData
        expect(typeof data.name).toBe('string');
        expect(typeof data.age).toBe('number');

        // return TestResponse
        return { id: 'test-id', success: true };
      });

      // send should accept TestData and return Promise<TestResponse>
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ id: 'response-id', success: false });
      });

      const result = send({ name: 'test', age: 25 });
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('conditional Return Types', () => {
    it('should return void by default (no ReturnValue specified)', () => {
      const { send } = createMessage<{ test: string }>('voidReturn');

      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback(undefined);
      });

      // The return type should be void, not Promise<void>
      const result = send({ test: 'data' });

      // At runtime, it's still a Promise due to the underlying implementation,
      // but TypeScript should see it as void
      expect(result).toBeInstanceOf(Promise);
    });

    it('should return void when explicitly set to void', () => {
      const { send } = createMessage<{ test: string }, void>('explicitVoid');

      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback(undefined);
      });

      const result = send({ test: 'data' });
      expect(result).toBeInstanceOf(Promise);
    });

    it('should return Promise<T> when explicitly set to Promise<T>', async () => {
      const { send } = createMessage<{ test: string }, Promise<{ result: string }>>(
        'promiseReturn',
      );

      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ result: 'success' });
      });

      const result = send({ test: 'data' });
      expect(result).toBeInstanceOf(Promise);

      const resolved = await result;
      expect(resolved).toEqual({ result: 'success' });
    });

    it('should work with non-Promise return types', () => {
      const { send } = createMessage<{ test: string }, { result: string }>('nonPromise');

      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ result: 'success' });
      });

      const result = send({ test: 'data' });
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('conditional Return Types - External Messages', () => {
    it('should return void by default for external messages', () => {
      const { send } = createExternalMessage<{ test: string }>('externalVoid');

      mockChrome.runtime.sendMessage.mockImplementation(
        (extensionId, message, callback) => {
          callback(undefined);
        },
      );

      const result = send('ext-id', { test: 'data' });
      expect(result).toBeInstanceOf(Promise);
    });

    it('should return Promise<T> when explicitly set for external messages', async () => {
      const { send } = createExternalMessage<
        { test: string },
        Promise<{ result: string }>
      >('externalPromise');

      mockChrome.runtime.sendMessage.mockImplementation(
        (extensionId, message, callback) => {
          callback({ result: 'external-success' });
        },
      );

      const result = send('ext-id', { test: 'data' });
      expect(result).toBeInstanceOf(Promise);

      const resolved = await result;
      expect(resolved).toEqual({ result: 'external-success' });
    });
  });

  describe('edge Cases', () => {
    it('should handle multiple options at once (tabId takes precedence)', async () => {
      const { send } = createMessage<{ test: string }, Promise<{ result: string }>>(
        'multiOption',
      );

      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback({ result: 'tab-priority' });
      });

      const result = await send(
        { test: 'data' },
        { tabId: TEST_TAB_ID, extensionId: 'ext-id' },
      );

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalled();
      expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled();
      expect(result).toEqual({ result: 'tab-priority' });
    });

    it('should handle empty data', async () => {
      const { send } = createMessage<Record<string, never>, Promise<{ result: string }>>(
        'emptyData',
      );

      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ result: 'empty-handled' });
      });

      const result = await send({});

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        { identifier: 'emptyData', data: {}, options: undefined },
        expect.any(Function),
      );
      expect(result).toEqual({ result: 'empty-handled' });
    });
  });

  describe('windowId messaging', () => {
    it('should send message with windowId option', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ result: 'success' });
      });

      const { send } = createMessage<{ test: string }, Promise<{ result: string }>>(
        'windowMessage',
      );

      const result = await send({ test: 'data' }, { windowId: 123 });

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        {
          identifier: 'windowMessage',
          data: { test: 'data' },
          options: { windowId: 123 },
        },
        expect.any(Function),
      );
      expect(result).toEqual({ result: 'success' });
    });

    it('should filter messages by windowId when receiving', async () => {
      const mockHandler = vi.fn().mockReturnValue('handled');
      const { onMessage } = createMessage<{ test: string }, string>('windowFilter');

      // Setup current window mock to return matching ID
      mockChrome.windows.getCurrent.mockImplementation((callback) => {
        callback({ id: 123 });
      });

      const dispose = onMessage(mockHandler);

      // Get the listener that was added
      const addedListener = mockChrome.runtime.onMessage.addListener.mock.calls[0]![0];

      // Send message with matching windowId
      const mockResponse = vi.fn();
      const result = addedListener(
        {
          identifier: 'windowFilter',
          data: { test: 'match' },
          options: { windowId: 123 },
        },
        {},
        mockResponse,
      );

      // Should return true for async processing
      expect(result).toBe(true);

      // Give async callback time to execute
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });

      // Handler should be called because window ID matches
      expect(mockHandler).toHaveBeenCalledWith({ test: 'match' }, {});

      dispose();
    });

    it('should ignore messages with non-matching windowId', async () => {
      const mockHandler = vi.fn().mockReturnValue('handled');
      const { onMessage } = createMessage<{ test: string }, string>('windowFilter');

      // Setup current window mock to return different ID
      mockChrome.windows.getCurrent.mockImplementation((callback) => {
        callback({ id: 456 }); // Different window ID
      });

      const dispose = onMessage(mockHandler);

      // Get the listener that was added
      const addedListener = mockChrome.runtime.onMessage.addListener.mock.calls[0]![0];

      // Send message with non-matching windowId
      const mockResponse = vi.fn();
      const result = addedListener(
        {
          identifier: 'windowFilter',
          data: { test: 'no-match' },
          options: { windowId: 123 },
        },
        {},
        mockResponse,
      );

      // Should return true for async processing
      expect(result).toBe(true);

      // Give async callback time to execute
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });

      // Handler should NOT be called because window ID doesn't match
      expect(mockHandler).not.toHaveBeenCalled();

      dispose();
    });

    it('should process messages without windowId normally', () => {
      const mockHandler = vi.fn().mockReturnValue('handled');
      const { onMessage } = createMessage<{ test: string }, string>('noWindowFilter');

      const dispose = onMessage(mockHandler);

      // Get the listener that was added
      const addedListener = mockChrome.runtime.onMessage.addListener.mock.calls[0]![0];

      // Send message without windowId
      const mockResponse = vi.fn();
      const result = addedListener(
        {
          identifier: 'noWindowFilter',
          data: { test: 'normal' },
        },
        {},
        mockResponse,
      );

      // Handler should be called
      expect(mockHandler).toHaveBeenCalledWith({ test: 'normal' }, {});
      expect(mockResponse).toHaveBeenCalledWith('handled');
      expect(result).toBe(true);

      dispose();
    });

    it('should handle missing windows API gracefully', () => {
      // Temporarily remove windows API
      const originalWindows = mockChrome.windows;

      (mockChrome as any).windows = undefined;

      const mockHandler = vi.fn().mockReturnValue('handled');
      const { onMessage } = createMessage<{ test: string }, string>('noWindowsApi');

      const dispose = onMessage(mockHandler);

      // Get the listener that was added
      const addedListener = mockChrome.runtime.onMessage.addListener.mock.calls[0]![0];

      // Send message with windowId when windows API is not available
      const mockResponse = vi.fn();
      const result = addedListener(
        {
          identifier: 'noWindowsApi',
          data: { test: 'fallback' },
          options: { windowId: 123 },
        },
        {},
        mockResponse,
      );

      // Handler should be called (windowId filtering ignored)
      expect(mockHandler).toHaveBeenCalledWith({ test: 'fallback' }, {});
      expect(mockResponse).toHaveBeenCalledWith('handled');
      expect(result).toBe(true);

      // Restore windows API
      mockChrome.windows = originalWindows;
      dispose();
    });
  });

  describe('error response handling', () => {
    it('should throw error when receiving error response object', async () => {
      const { send } = createMessage<{ test: string }, { result: string }>('errorTest');

      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        // Simulate an error response from message handler
        callback({ error: 'Something went wrong' });
      });

      await expect(send({ test: 'data' })).rejects.toThrow('Something went wrong');
    });

    it('should return normal response when no error', async () => {
      const { send } = createMessage<{ test: string }, { result: string }>('normalTest');

      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ result: 'success' });
      });

      const result = await send({ test: 'data' });
      expect(result).toEqual({ result: 'success' });
    });

    it('should handle error response with external messages', async () => {
      const { send } = createExternalMessage<{ test: string }, { result: string }>(
        'externalErrorTest',
      );

      mockChrome.runtime.sendMessage.mockImplementation(
        (extensionId, message, callback) => {
          callback({ error: 'External error occurred' });
        },
      );

      await expect(send('ext-123', { test: 'data' })).rejects.toThrow(
        'External error occurred',
      );
    });

    it('should handle error response with tab messages', async () => {
      const { send } = createMessage<{ test: string }, { result: string }>(
        'tabErrorTest',
      );

      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback({ error: 'Tab communication failed' });
      });

      await expect(send({ test: 'data' }, { tabId: 123 })).rejects.toThrow(
        'Tab communication failed',
      );
    });

    it('should not throw when response is null or undefined', async () => {
      const { send } = createMessage<{ test: string }, void>('nullTest');

      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback(null);
      });

      const result = await send({ test: 'data' });
      expect(result).toBeNull();

      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback(undefined);
      });

      const result2 = await send({ test: 'data' });
      expect(result2).toBeUndefined();
    });

    it('should not throw when response has error property but is not an error object', async () => {
      const { send } = createMessage<{ test: string }, { error: boolean }>(
        'nonErrorTest',
      );

      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        // This is a valid response that happens to have an 'error' property but isn't an error
        callback({ error: false });
      });

      const result = await send({ test: 'data' });
      expect(result).toEqual({ error: false });
    });

    it('should maintain end-to-end error flow from handler to sender', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Set up message handler that throws an error
      const { onMessage: subscribe, send } = createMessage<
        { test: string },
        { result: string }
      >('e2eErrorTest');

      const errorHandler = vi.fn().mockRejectedValue(new Error('Handler error'));
      subscribe(errorHandler);

      // Get the listener that was added
      const listener =
        mockChrome.runtime.onMessage.addListener.mock.calls.slice(-1)[0]![0];

      // Mock sendMessage to simulate the full flow
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        // Simulate what happens when the message is processed
        const mockSender = {};
        const mockSendResponse = callback;

        // Call the listener (this simulates the message being received and processed)
        listener(message, mockSender, mockSendResponse);

        // The callback will be called asynchronously by the error handler
        return true;
      });

      // This should throw because the handler throws an error
      await expect(send({ test: 'data' })).rejects.toThrow('Handler error');

      // Clean up
      consoleError.mockRestore();
    });
  });
});
