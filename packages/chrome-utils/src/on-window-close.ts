/**
 * Manages callbacks for when specific Chrome windows are closed.
 * Useful for triggering alerts, saving data, or cleaning up resources
 * when a specific popup or window is removed.
 */

type CloseCallback = () => void;

const windowCloseListeners = new Map<number, Set<CloseCallback>>();

let isListenerInitialized = false;

function initializeListener(): void {
  if (isListenerInitialized) {
    return;
  }
  isListenerInitialized = true;

  chrome.windows.onRemoved.addListener((windowId) => {
    const listeners = windowCloseListeners.get(windowId);
    if (listeners) {
      listeners.forEach((callback) => {
        callback();
      });
      windowCloseListeners.delete(windowId);
    }
  });
}

/**
 * Registers a callback to be executed when a specific window is closed.
 * @param windowId - The chrome window ID to watch
 * @param callback - Function to execute when the window closes
 * @returns A function to unsubscribe (remove) this specific listener
 * @example
 * const unsubscribe = onWindowClose(123, () => {
 *   console.log("Window 123 was closed!");
 * });
 */
export function onWindowClose(windowId: number, callback: CloseCallback): () => void {
  initializeListener();

  let listeners = windowCloseListeners.get(windowId);
  if (!listeners) {
    listeners = new Set();
    windowCloseListeners.set(windowId, listeners);
  }

  listeners.add(callback);

  return (): void => {
    const currentListeners = windowCloseListeners.get(windowId);
    if (currentListeners) {
      currentListeners.delete(callback);
      if (currentListeners.size === 0) {
        windowCloseListeners.delete(windowId);
      }
    }
  };
}
