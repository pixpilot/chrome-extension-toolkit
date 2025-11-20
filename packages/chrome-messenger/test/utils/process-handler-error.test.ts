import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { processHandlerError } from '../../src/utils/process-handler-error';

describe('processHandlerError', () => {
  const identifier = 'TEST_MESSAGE';
  let nativeSendResponse: ReturnType<typeof vi.fn>;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    nativeSendResponse = vi.fn();
    originalConsoleError = console.error;
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('application errors (should NOT log to console)', () => {
    it('should not log "Method not implemented" error', () => {
      const error = new Error('Method not implemented.');

      processHandlerError(error, identifier, nativeSendResponse);

      expect(console.error).not.toHaveBeenCalled();
      expect(nativeSendResponse).toHaveBeenCalledWith({
        error: 'Method not implemented.',
      });
    });

    it('should not log custom application error', () => {
      const error = new Error('Custom validation failed');

      processHandlerError(error, identifier, nativeSendResponse);

      expect(console.error).not.toHaveBeenCalled();
      expect(nativeSendResponse).toHaveBeenCalledWith({
        error: 'Custom validation failed',
      });
    });

    it('should not log generic runtime error without chrome keyword', () => {
      const error = new Error('Some random error occurred');

      processHandlerError(error, identifier, nativeSendResponse);

      expect(console.error).not.toHaveBeenCalled();
      expect(nativeSendResponse).toHaveBeenCalledWith({
        error: 'Some random error occurred',
      });
    });
  });

  describe('chrome-specific errors (should log to console)', () => {
    it('should log "receiving end does not exist" error', () => {
      const error = new Error('receiving end does not exist');

      processHandlerError(error, identifier, nativeSendResponse);

      expect(console.error).toHaveBeenCalledWith(
        `Error in message handler for ${identifier}:`,
        error,
      );
      expect(nativeSendResponse).toHaveBeenCalledWith({
        error: 'receiving end does not exist',
      });
    });

    it('should log "extension context invalidated" error', () => {
      const error = new Error('extension context invalidated');

      processHandlerError(error, identifier, nativeSendResponse);

      expect(console.error).toHaveBeenCalledWith(
        `Error in message handler for ${identifier}:`,
        error,
      );
      expect(nativeSendResponse).toHaveBeenCalledWith({
        error: 'extension context invalidated',
      });
    });

    it('should log "tab was closed" error', () => {
      const error = new Error('tab was closed');

      processHandlerError(error, identifier, nativeSendResponse);

      expect(console.error).toHaveBeenCalledWith(
        `Error in message handler for ${identifier}:`,
        error,
      );
      expect(nativeSendResponse).toHaveBeenCalledWith({
        error: 'tab was closed',
      });
    });

    it('should log error containing "chrome" keyword', () => {
      const error = new Error('Chrome extension failed to load');

      processHandlerError(error, identifier, nativeSendResponse);

      expect(console.error).toHaveBeenCalledWith(
        `Error in message handler for ${identifier}:`,
        error,
      );
      expect(nativeSendResponse).toHaveBeenCalledWith({
        error: 'Chrome extension failed to load',
      });
    });
  });

  describe('error handling edge cases', () => {
    it('should handle non-Error objects', () => {
      const error = 'String error message';

      processHandlerError(error, identifier, nativeSendResponse);

      expect(console.error).not.toHaveBeenCalled();
      expect(nativeSendResponse).toHaveBeenCalledWith({
        error: '',
      });
    });

    it('should handle null error', () => {
      const error = null;

      processHandlerError(error, identifier, nativeSendResponse);

      expect(console.error).not.toHaveBeenCalled();
      expect(nativeSendResponse).toHaveBeenCalledWith({
        error: '',
      });
    });

    it('should handle undefined error', () => {
      const error = undefined;

      processHandlerError(error, identifier, nativeSendResponse);

      expect(console.error).not.toHaveBeenCalled();
      expect(nativeSendResponse).toHaveBeenCalledWith({
        error: '',
      });
    });

    it('should handle Error without message property', () => {
      const error = new Error('test error');
      // @ts-expect-error - testing edge case
      delete error.message;

      processHandlerError(error, identifier, nativeSendResponse);

      expect(console.error).not.toHaveBeenCalled();
      expect(nativeSendResponse).toHaveBeenCalledWith({
        error: '',
      });
    });
  });
});
