import { mockBrowser, mockChrome } from '@pixpilot/chrome-testing-tools';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMessage } from '../src/chrome-messenger';

// Define custom error classes for testing
class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public code: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

class CustomDataError extends Error {
  constructor(
    message: string,
    public data: { userId: string; reason: string },
  ) {
    super(message);
    this.name = 'CustomDataError';
  }
}

describe('custom error handling', () => {
  beforeEach(() => {
    (globalThis as any).chrome = mockChrome;
    (globalThis as any).browser = mockBrowser;
  });

  afterEach(() => {
    mockChrome.runtime.onMessage.addListener.mockClear();
    mockChrome.runtime.sendMessage.mockClear();
  });

  it('should preserve error name from custom errors', async () => {
    const { send, onMessage } = createMessage<{ email: string }, { success: boolean }>(
      'custom-error-test',
    );

    onMessage(() => {
      throw new ValidationError('Email is required', 'email', 'REQUIRED');
    });

    // Simulate the message passing
    const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0]![0];
    mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
      const mockSendResponse = callback;
      listener(message, {}, mockSendResponse);
      return true;
    });

    try {
      await send({ email: '' });
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Email is required');
    }
  });

  it('should preserve custom properties from error objects', async () => {
    const { send, onMessage } = createMessage<{ email: string }, { success: boolean }>(
      'custom-props-test',
    );

    onMessage(() => {
      throw new ValidationError('Invalid email format', 'email', 'INVALID_FORMAT');
    });

    const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0]![0];
    mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
      const mockSendResponse = callback;
      listener(message, {}, mockSendResponse);
      return true;
    });

    try {
      await send({ email: 'invalid' });
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Invalid email format');
      expect(error.field).toBe('email');
      expect(error.code).toBe('INVALID_FORMAT');
    }
  });

  it('should handle authentication errors with status codes', async () => {
    const { send, onMessage } = createMessage<{ token: string }, { user: any }>(
      'auth-error-test',
    );

    const UNAUTHORIZED_STATUS = 401;
    onMessage(() => {
      throw new AuthenticationError('Invalid token', UNAUTHORIZED_STATUS);
    });

    const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0]![0];
    mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
      const mockSendResponse = callback;
      listener(message, {}, mockSendResponse);
      return true;
    });

    try {
      await send({ token: 'invalid' });
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.name).toBe('AuthenticationError');
      expect(error.message).toBe('Invalid token');
      expect(error.statusCode).toBe(UNAUTHORIZED_STATUS);
    }
  });

  it('should handle errors with complex data objects', async () => {
    const { send, onMessage } = createMessage<{ userId: string }, { success: boolean }>(
      'complex-error-test',
    );

    onMessage(() => {
      throw new CustomDataError('User action blocked', {
        userId: '123',
        reason: 'Insufficient permissions',
      });
    });

    const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0]![0];
    mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
      const mockSendResponse = callback;
      listener(message, {}, mockSendResponse);
      return true;
    });

    try {
      await send({ userId: '123' });
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.name).toBe('CustomDataError');
      expect(error.message).toBe('User action blocked');
      expect(error.data).toEqual({
        userId: '123',
        reason: 'Insufficient permissions',
      });
    }
  });

  it('should handle standard Error without custom name', async () => {
    const { send, onMessage } = createMessage<{ test: string }, { success: boolean }>(
      'standard-error-test',
    );

    onMessage(() => {
      throw new Error('Standard error message');
    });

    const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0]![0];
    mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
      const mockSendResponse = callback;
      listener(message, {}, mockSendResponse);
      return true;
    });

    try {
      await send({ test: 'data' });
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Standard error message');
      // Standard errors don't have a custom name, so it should be 'Error'
      expect(error.name).toBe('Error');
    }
  });

  it('should allow error type checking by name', async () => {
    const { send, onMessage } = createMessage<{ email: string }, { success: boolean }>(
      'error-type-check',
    );

    onMessage(({ email }) => {
      if (!email) {
        throw new ValidationError('Email required', 'email', 'REQUIRED');
      }
      if (!email.includes('@')) {
        throw new ValidationError('Invalid email', 'email', 'INVALID');
      }
      return { success: true };
    });

    const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0]![0];
    mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
      const mockSendResponse = callback;
      listener(message, {}, mockSendResponse);
      return true;
    });

    // Test first validation error
    try {
      await send({ email: '' });
      expect.fail('Should have thrown');
    } catch (error: any) {
      // Can check by name since instanceof won't work across message boundary
      expect(error.name).toBe('ValidationError');
      expect(error.field).toBe('email');
      expect(error.code).toBe('REQUIRED');
    }

    // Test second validation error
    try {
      await send({ email: 'invalid' });
      expect.fail('Should have thrown');
    } catch (error: any) {
      expect(error.name).toBe('ValidationError');
      expect(error.field).toBe('email');
      expect(error.code).toBe('INVALID');
    }

    // Test success
    const result = await send({ email: 'test@example.com' });
    expect(result).toEqual({ success: true });
  });
});
