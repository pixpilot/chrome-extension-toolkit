import { mockChrome } from '@pixpilot/chrome-testing-tools';

// test/chrome-messenger/window-id.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMessage } from '../src/chrome-messenger';

describe('windowId integration tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;

    (globalThis as any).chrome = mockChrome;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('send with windowId', () => {
    it('should include windowId in message options', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ success: true });
      });

      const { send } = createMessage<{ text: string }, Promise<{ success: boolean }>>(
        'windowTest',
      );

      const result = await send({ text: 'hello' }, { windowId: 123 });

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        {
          identifier: 'windowTest',
          data: { text: 'hello' },
          options: { windowId: 123 },
        },
        expect.any(Function),
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('receive with windowId filtering', () => {
    it('should process message when window ID matches', async () => {
      const handler = vi.fn().mockReturnValue({ processed: true });

      // Mock current window ID to match
      mockChrome.windows.getCurrent.mockImplementation((callback) => {
        callback({ id: 123 });
      });

      const { onMessage } = createMessage<{ text: string }, { processed: boolean }>(
        'windowTest',
      );

      const dispose = onMessage(handler);

      // Get the registered listener
      const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0]![0];

      // Send message with matching windowId
      const mockResponse = vi.fn();
      const result = listener(
        {
          identifier: 'windowTest',
          data: { text: 'hello' },
          options: { windowId: 123 },
        },
        {},
        mockResponse,
      );

      expect(result).toBe(true); // Keep channel open for async processing

      // Wait for async processing
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });

      expect(handler).toHaveBeenCalledWith({ text: 'hello' }, {});
      expect(mockResponse).toHaveBeenCalledWith({ processed: true });

      dispose();
    });

    it('should NOT process message when window ID does not match', async () => {
      const handler = vi.fn().mockReturnValue({ processed: true });

      // Mock current window ID to NOT match
      mockChrome.windows.getCurrent.mockImplementation((callback) => {
        callback({ id: 456 }); // Different window ID
      });

      const { onMessage } = createMessage<{ text: string }, { processed: boolean }>(
        'windowTest',
      );

      const dispose = onMessage(handler);

      // Get the registered listener
      const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0]![0];

      // Send message with non-matching windowId
      const mockResponse = vi.fn();
      const result = listener(
        {
          identifier: 'windowTest',
          data: { text: 'hello' },
          options: { windowId: 123 }, // Different from current window (456)
        },
        {},
        mockResponse,
      );

      expect(result).toBe(true); // Keep channel open for async processing

      // Wait for async processing
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });

      // Handler should NOT have been called
      expect(handler).not.toHaveBeenCalled();
      // But response should still be called to close the message channel properly
      expect(mockResponse).toHaveBeenCalledWith(undefined);

      dispose();
    });

    it('should process message normally when no windowId is provided', () => {
      const handler = vi.fn().mockReturnValue({ processed: true });

      const { onMessage } = createMessage<{ text: string }, { processed: boolean }>(
        'windowTest',
      );

      const dispose = onMessage(handler);

      // Get the registered listener
      const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0]![0];

      // Send message without windowId
      const mockResponse = vi.fn();
      const result = listener(
        {
          identifier: 'windowTest',
          data: { text: 'hello' },
          // No options field
        },
        {},
        mockResponse,
      );

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledWith({ text: 'hello' }, {});
      expect(mockResponse).toHaveBeenCalledWith({ processed: true });

      dispose();
    });

    it('should process message when windows API is not available', () => {
      const handler = vi.fn().mockReturnValue({ processed: true });

      // Remove windows API temporarily
      const originalWindows = mockChrome.windows;

      (mockChrome as any).windows = undefined;

      const { onMessage } = createMessage<{ text: string }, { processed: boolean }>(
        'windowTest',
      );

      const dispose = onMessage(handler);

      // Get the registered listener
      const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0]![0];

      // Send message with windowId when windows API is unavailable
      const mockResponse = vi.fn();
      const result = listener(
        {
          identifier: 'windowTest',
          data: { text: 'hello' },
          options: { windowId: 123 },
        },
        {},
        mockResponse,
      );

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledWith({ text: 'hello' }, {});
      expect(mockResponse).toHaveBeenCalledWith({ processed: true });

      // Restore windows API
      mockChrome.windows = originalWindows;
      dispose();
    });
  });
});
