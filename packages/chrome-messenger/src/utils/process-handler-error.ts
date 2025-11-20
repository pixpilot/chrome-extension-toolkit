import { categorizeRuntimeError } from './error-handler';

/**
 * Handles errors in message handlers by conditionally logging and sending error response.
 * Only logs Chrome/runtime errors, not intentional application errors.
 * @param error - The error that occurred
 * @param identifier - The message identifier to help locate which handler failed
 * @param nativeSendResponse - The response callback function
 */
export function processHandlerError(
  error: unknown,
  identifier: string,
  nativeSendResponse: (response: any) => void,
): void {
  // Extract error message safely
  const errorMessage =
    error && typeof error === 'object' && 'message' in error
      ? (error as Error).message || ''
      : '';

  const chromeError = categorizeRuntimeError(errorMessage);

  // Only log Chrome/runtime errors, not intentional application errors
  // Log if: it's a recognized Chrome error OR message contains 'chrome'
  const isChromeError =
    chromeError.code !== 'RUNTIME_ERROR' || errorMessage.toLowerCase().includes('chrome');

  if (isChromeError) {
    console.error(`Error in message handler for ${identifier}:`, error);
  }

  nativeSendResponse({ error: errorMessage });
}
