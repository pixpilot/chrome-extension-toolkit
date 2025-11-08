import { describe, expect, it } from 'vitest';
import {
  categorizeRuntimeError,
  createDetailedErrorMessage,
} from '../src/utils/error-handler';

describe('categorizeRuntimeError', () => {
  it('should categorize "Receiving end does not exist" as NO_RECEIVER', () => {
    const result = categorizeRuntimeError('Receiving end does not exist');
    expect(result.code).toBe('NO_RECEIVER');
    expect(result.reason).toBe('No listener registered for this message');
    expect(result.solution).toContain('onMessage listener is registered');
  });

  it('should categorize "Could not establish connection" as NO_RECEIVER', () => {
    const result = categorizeRuntimeError('Could not establish connection');
    expect(result.code).toBe('NO_RECEIVER');
  });

  it('should categorize tab errors as TAB_UNAVAILABLE', () => {
    expect(categorizeRuntimeError('Tab was closed').code).toBe('TAB_UNAVAILABLE');
    expect(categorizeRuntimeError('No tab with id: 123').code).toBe('TAB_UNAVAILABLE');
    expect(categorizeRuntimeError('cannot access contents of url').code).toBe(
      'TAB_UNAVAILABLE',
    );
    expect(categorizeRuntimeError('cannot access a chrome://').code).toBe(
      'TAB_UNAVAILABLE',
    );
  });

  it('should categorize context invalidated errors', () => {
    const result = categorizeRuntimeError('Extension context invalidated');
    expect(result.code).toBe('CONTEXT_INVALIDATED');
    expect(result.reason).toBe('Extension was reloaded, updated, or disabled');
  });

  it('should categorize permission errors', () => {
    const result = categorizeRuntimeError('requires permission');
    expect(result.code).toBe('PERMISSION_DENIED');
    expect(result.solution).toContain('manifest.json');
  });

  it('should categorize port disconnected errors', () => {
    const result = categorizeRuntimeError('message port closed');
    expect(result.code).toBe('PORT_DISCONNECTED');
    expect(result.reason).toContain('port was closed');
  });

  it('should categorize unknown errors as RUNTIME_ERROR', () => {
    const result = categorizeRuntimeError('Some other error');
    expect(result.code).toBe('RUNTIME_ERROR');
    expect(result.reason).toBe('Chrome runtime error occurred');
  });

  it('should be case-insensitive', () => {
    expect(categorizeRuntimeError('RECEIVING END DOES NOT EXIST').code).toBe(
      'NO_RECEIVER',
    );
    expect(categorizeRuntimeError('TAB WAS CLOSED').code).toBe('TAB_UNAVAILABLE');
    expect(categorizeRuntimeError('EXTENSION CONTEXT INVALIDATED').code).toBe(
      'CONTEXT_INVALIDATED',
    );
  });
});

describe('createDetailedErrorMessage', () => {
  it('should create a detailed error message for runtime target', () => {
    const chromeError = categorizeRuntimeError('Receiving end does not exist');
    const result = createDetailedErrorMessage(
      'test-message',
      chromeError,
      'Receiving end does not exist',
    );
    expect(result).toContain('[chrome-messenger]');
    expect(result).toContain('test-message');
    expect(result).toContain('runtime');
    expect(result).toContain('No listener registered');
  });

  it('should create a detailed error message for tab target', () => {
    const chromeError = categorizeRuntimeError('Tab was closed');
    const result = createDetailedErrorMessage(
      'test-message',
      chromeError,
      'Tab was closed',
      {
        tabId: 123,
      },
    );
    expect(result).toContain('tab 123');
    expect(result).toContain('Tab is closed or page is restricted');
  });

  it('should create a detailed error message for extension target', () => {
    const chromeError = categorizeRuntimeError('Extension context invalidated');
    const result = createDetailedErrorMessage(
      'test-message',
      chromeError,
      'Extension context invalidated',
      { extensionId: 'ext-123' },
    );
    expect(result).toContain('extension ext-123');
    expect(result).toContain('Extension was reloaded');
  });

  it('should handle application errors', () => {
    const result = createDetailedErrorMessage(
      'user-action',
      {
        code: 'APPLICATION_ERROR',
        reason: 'Handler threw an error',
        solution: 'Fix the error in your message handler',
        includes: [],
      },
      'User not found',
      { tabId: 456 },
    );
    expect(result).toContain('tab 456');
    expect(result).toContain('Handler threw an error');
    expect(result).toContain('User not found');
  });

  it('should prioritize tabId over extensionId when both are present', () => {
    const chromeError = categorizeRuntimeError('Some error');
    const result = createDetailedErrorMessage('test-message', chromeError, 'Some error', {
      tabId: 789,
      extensionId: 'ext-456',
    });
    expect(result).toContain('tab 789');
    expect(result).not.toContain('ext-456');
  });

  it('should include reason, solution, and original message', () => {
    const chromeError = categorizeRuntimeError('Receiving end does not exist');
    const result = createDetailedErrorMessage(
      'test',
      chromeError,
      'Receiving end does not exist',
    );
    expect(result).toContain('Reason:');
    expect(result).toContain('Solution:');
    expect(result).toContain('Original:');
  });
});
