import type { SendOptions } from '../types';
import { getBrowserEnv } from './get-browser-env';

/**
 * Handles windowId filtering for message listeners with proper async response handling
 * @param options - Message options containing windowId
 * @param onMatch - Callback to execute if window matches or no filtering needed
 * @param sendResponse - Function to send response back to close message channel
 * @param onNoMatch - Optional callback to execute if window doesn't match (for logging, etc.)
 * @returns boolean indicating if message channel should stay open
 */
export function processMessageWithWindowFilter<T = any>(
  options: SendOptions | undefined,
  onMatch: () => void,
  sendResponse: (response?: T) => void,
  onNoMatch?: () => void,
): boolean {
  if (options?.windowId != null) {
    // Get current window ID and compare
    const browserEnv = getBrowserEnv();
    if (browserEnv?.windows) {
      browserEnv.windows.getCurrent((currentWindow) => {
        if (currentWindow.id === options.windowId) {
          onMatch();
        } else {
          // Not for this window, execute no-match callback if provided
          onNoMatch?.();
        }
        // Always send response to complete the message channel
        sendResponse(undefined as T);
      });
      return true; // Keep message channel open for async window check
    }
    // If windows API not available, ignore windowId filtering
    onMatch();
    sendResponse(undefined as T);
    return true;
  }

  // No windowId filtering needed
  onMatch();
  sendResponse(undefined as T);
  return true;
}

/**
 * Variant for cases where you want to handle sendResponse manually in the callbacks
 * @param options - Message options containing windowId
 * @param onMatch - Callback to execute if window matches or no filtering needed
 * @param onNoMatch - Callback to execute if window doesn't match
 * @returns boolean indicating if message channel should stay open
 */
export function handleWindowFilterWithManualResponse(
  options: SendOptions | undefined,
  onMatch: () => void,
  onNoMatch: () => void,
): boolean {
  if (options?.windowId != null) {
    // Get current window ID and compare
    const browserEnv = getBrowserEnv();
    if (browserEnv?.windows) {
      browserEnv.windows.getCurrent((currentWindow) => {
        if (currentWindow.id === options.windowId) {
          onMatch();
        } else {
          onNoMatch();
        }
      });
      return true; // Keep message channel open for async window check
    }
    // If windows API not available, ignore windowId filtering
    onMatch();
    return true;
  }

  // No windowId filtering needed
  onMatch();
  return true;
}
