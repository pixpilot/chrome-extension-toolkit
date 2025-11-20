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

  // Build error response with type information
  const errorResponse: {
    error: string;
    errorType?: string;
    errorData?: Record<string, unknown>;
  } = { error: errorMessage };

  // Preserve error type name (e.g., 'ValidationError', 'CustomError')
  if (error && typeof error === 'object' && 'name' in error && error.name !== 'Error') {
    errorResponse.errorType = error.name as string;
  }

  // Extract custom properties from the error (excluding standard Error properties)
  if (error && typeof error === 'object') {
    const standardProps = ['name', 'message', 'stack'];
    const customProps: Record<string, unknown> = {};

    for (const key of Object.keys(error)) {
      if (!standardProps.includes(key)) {
        customProps[key] = (error as any)[key];
      }
    }

    if (Object.keys(customProps).length > 0) {
      errorResponse.errorData = customProps;
    }
  }

  nativeSendResponse(errorResponse);
}
