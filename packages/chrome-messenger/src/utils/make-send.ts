import type { SendOptions } from '../types';
import { categorizeRuntimeError, createDetailedErrorMessage } from './error-handler';
import { getBrowserEnv } from './get-browser-env';

/**
 * Type guard to check if response is an error response
 */
function isErrorResponse(response: unknown): response is { error: string } {
  return (
    response !== null &&
    typeof response === 'object' &&
    'error' in response &&
    typeof (response as Record<string, unknown>).error === 'string'
  );
}

/**
 * Creates a message sender function with windowId filtering support
 * @param identifier - Message identifier
 * @returns Sender function
 */
export function makeSend(identifier: string) {
  return async <Data, ReturnValue>(
    data: Data,
    options?: SendOptions,
  ): Promise<ReturnValue> =>
    new Promise<ReturnValue>((resolve, reject) => {
      const browserEnv = getBrowserEnv();

      if (!browserEnv) {
        reject(new Error('[chrome-messenger] browserEnv environment is not defined'));
        return;
      }

      if (browserEnv.runtime == null) {
        reject(new Error('[chrome-messenger] browserEnv.runtime is not defined'));
        return;
      }

      const message = { identifier, data, options };
      const responseCallback = (response: unknown) => {
        if (browserEnv.runtime.lastError) {
          const chromeError = categorizeRuntimeError(
            browserEnv.runtime.lastError.message || '',
          );
          const detailedMessage = createDetailedErrorMessage(
            identifier,
            chromeError,
            browserEnv.runtime.lastError.message || 'Unknown error',
            options,
          );
          return reject(new Error(detailedMessage));
        }

        // Check if response is an error object (intentionally thrown by application)
        if (isErrorResponse(response)) {
          const detailedMessage = createDetailedErrorMessage(
            identifier,
            {
              code: 'APPLICATION_ERROR',
              reason: 'Handler threw an error',
              solution: 'Fix the error in your message handler',
            },
            response.error,
            options,
          );
          return reject(new Error(detailedMessage));
        }

        resolve(response as ReturnValue);
        return undefined;
      };

      // Send to specific tab
      if (options?.tabId != null) {
        if (typeof browserEnv.tabs === 'undefined' || browserEnv.tabs === null) {
          reject(
            new Error(
              `[chrome-messenger] Failed to send to tab ${options?.tabId}: browserEnv.tabs is not defined`,
            ),
          );
          return;
        }
        browserEnv.tabs.sendMessage(options.tabId, message, responseCallback);
        return;
      }

      // Send to external extension
      if (typeof options?.extensionId === 'string' && options.extensionId.length > 0) {
        browserEnv.runtime.sendMessage(options.extensionId, message, responseCallback);
        return;
      }

      // Send to runtime (background/content script)
      browserEnv.runtime.sendMessage(message, responseCallback);
    });
}
