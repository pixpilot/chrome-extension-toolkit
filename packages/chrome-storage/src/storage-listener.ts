/**
 * Storage Listener
 * Provides key-specific listeners for chrome.storage.onChanged events
 */

import type { StorageArea } from './chrome-storage';

/**
 * Type for storage change events
 */
export interface StorageChange<T = unknown> {
  /** The old value (undefined if the item was just created) */
  oldValue?: T;
  /** The new value (undefined if the item was just deleted) */
  newValue?: T;
}

/**
 * Callback function for storage changes
 */
export type StorageChangeCallback<T = unknown> = (
  change: StorageChange<T>,
  key: string,
  area: StorageArea,
) => void;

/**
 * Internal listener registration
 */
interface ListenerRegistration {
  key: string;
  callback: StorageChangeCallback<unknown>;
  area?: StorageArea;
}

/**
 * Storage Listener Manager
 * Manages key-specific listeners for chrome.storage.onChanged events
 *
 * This class provides a higher-level abstraction over chrome.storage.onChanged
 * that allows you to listen to changes for specific keys instead of all changes.
 *
 * @example
 * ```typescript
 * const listener = new StorageListener();
 *
 * // Listen to a specific key
 * const unsubscribe = listener.addListener('username', (change, key, area) => {
 *   console.log(`${key} changed from ${change.oldValue} to ${change.newValue}`);
 * });
 *
 * // Later, remove the listener
 * unsubscribe();
 * ```
 */
export class StorageListener {
  private listeners: Set<ListenerRegistration> = new Set();
  private chromeListener:
    | ((changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void)
    | null = null;

  /**
   * Add a listener for a specific key
   *
   * @param key - The storage key to watch
   * @param callback - Function to call when the key changes
   * @param area - Optional storage area to filter by ('local' or 'sync'). If not provided, listens to both areas.
   * @returns A function to remove the listener
   *
   * @example
   * ```typescript
   * const listener = new StorageListener();
   *
   * // Listen to username changes in local storage only
   * const unsubscribe = listener.addListener('username', (change, key, area) => {
   *   console.log(`Username changed to: ${change.newValue}`);
   * }, 'local');
   *
   * // Remove listener when done
   * unsubscribe();
   * ```
   */
  addListener<T = unknown>(
    key: string,
    callback: StorageChangeCallback<T>,
    area?: StorageArea,
  ): () => void {
    const registration: ListenerRegistration = {
      key,
      callback: callback as StorageChangeCallback<unknown>,
      area,
    };

    this.listeners.add(registration);

    // Initialize chrome listener if this is the first listener
    if (this.listeners.size === 1) {
      this.initializeChromeListener();
    }

    // Return unsubscribe function
    return () => {
      this.removeListener(registration);
    };
  }

  /**
   * Remove a specific listener registration
   */
  private removeListener(registration: ListenerRegistration): void {
    this.listeners.delete(registration);

    // Clean up chrome listener if no more listeners
    if (this.listeners.size === 0) {
      this.cleanupChromeListener();
    }
  }

  /**
   * Initialize the underlying chrome.storage.onChanged listener
   */
  private initializeChromeListener(): void {
    if (this.chromeListener) {
      return; // Already initialized
    }

    this.chromeListener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      const area = areaName as StorageArea;

      // Notify all matching listeners
      for (const registration of this.listeners) {
        // Filter by area if specified
        if (!registration.area || registration.area === area) {
          // Check if this listener's key was changed
          const change = changes[registration.key];
          if (change) {
            const storageChange: StorageChange = {
              oldValue: change.oldValue,
              newValue: change.newValue,
            };

            try {
              registration.callback(storageChange, registration.key, area);
            } catch (error) {
              console.error('Error in storage listener callback:', error);
            }
          }
        }
      }
    };

    chrome.storage.onChanged.addListener(this.chromeListener);
  }

  /**
   * Clean up the chrome listener when no more listeners exist
   */
  private cleanupChromeListener(): void {
    if (this.chromeListener) {
      chrome.storage.onChanged.removeListener(this.chromeListener);
      this.chromeListener = null;
    }
  }

  /**
   * Remove all listeners and clean up
   */
  removeAllListeners(): void {
    this.listeners.clear();
    this.cleanupChromeListener();
  }

  /**
   * Get the number of active listeners
   * Useful for testing and debugging
   */
  get listenerCount(): number {
    return this.listeners.size;
  }
}
