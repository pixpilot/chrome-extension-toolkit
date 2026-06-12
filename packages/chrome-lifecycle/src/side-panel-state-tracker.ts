/* eslint-disable no-console */
import type { SidePanelClientMessage, SidePanelStateData } from './types';

const INITIAL_RECONNECT_DELAY_MS = 250;
const MAX_RECONNECT_DELAY_MS = 5000;
const RECONNECT_BACKOFF_FACTOR = 2;

let isInitialized = false;

export interface InitializeSidePanelStateTrackerOptions {
  /**
   * When true, visibilitychange events report document.hidden as hidden state.
   * Disable this if you only want open/closed port state.
   */
  trackDocumentVisibility?: boolean;
}

/**
 * Should only be called inside a Chrome extension side panel page.
 */
export function initializeSidePanelStateTracker(
  options: InitializeSidePanelStateTrackerOptions = {},
): () => void {
  if (isInitialized) {
    console.info('Side panel state tracker already initialized');
    return () => {};
  }
  isInitialized = true;

  const { trackDocumentVisibility = true } = options;

  let port: chrome.runtime.Port | undefined;
  let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
  let reconnectAttempts = 0;
  let handleVisibilityChange: (() => void) | undefined;
  let isDisposed = false;

  function clearReconnectTimeout() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = undefined;
    }
  }

  chrome.windows.getCurrent((win) => {
    if (isDisposed) {
      return;
    }

    if (win.id == null) {
      console.error('[side-panel-state-tracker] Could not get window ID');
      return;
    }

    const windowId = win.id;

    function getCurrentSidePanelState(): SidePanelStateData['state'] {
      if (trackDocumentVisibility && document.hidden) {
        return 'hidden';
      }

      return 'visible';
    }

    function scheduleReconnect() {
      if (isDisposed || reconnectTimeout) {
        return;
      }

      port = undefined;
      console.info(
        '[side-panel-state-tracker] Connection to background lost, scheduling reconnect...',
      );

      const reconnectDelay = Math.min(
        INITIAL_RECONNECT_DELAY_MS * RECONNECT_BACKOFF_FACTOR ** reconnectAttempts,
        MAX_RECONNECT_DELAY_MS,
      );
      reconnectAttempts += 1;

      reconnectTimeout = setTimeout(() => {
        reconnectTimeout = undefined;
        connectToBackground('reconnected');
      }, reconnectDelay);
    }

    function setSidePanelState(
      state: Omit<SidePanelStateData, 'port' | 'windowId' | 'type'>,
    ) {
      const currentPort = port;

      if (!currentPort) {
        scheduleReconnect();
        return;
      }

      try {
        currentPort.postMessage({
          ...state,
          windowId,
          type: 'side-panel-state-tracker',
          timestamp: Date.now(),
        } as SidePanelStateData);
      } catch (error) {
        console.error('[side-panel-state-tracker] Failed to send message:', error);
        scheduleReconnect();
      }
    }

    function connectToBackground(reason: SidePanelStateData['reason']) {
      if (isDisposed) {
        return;
      }

      clearReconnectTimeout();

      try {
        const connectedPort = chrome.runtime.connect({ name: chrome.runtime.id });
        port = connectedPort;
        reconnectAttempts = 0;

        connectedPort.onDisconnect.addListener(() => {
          if (port !== connectedPort) {
            return;
          }

          console.info('[side-panel-state-tracker] Background connection lost.');
          scheduleReconnect();
        });

        connectedPort.onMessage.addListener((message: SidePanelClientMessage) => {
          if (message.type === 'close-side-panel') {
            isDisposed = true;
            clearReconnectTimeout();
            window.close();
          }
        });

        setSidePanelState({
          // A newly loaded side panel should register as open even when Chrome
          // briefly reports document.hidden during startup.
          state: reason === 'document-load' ? 'visible' : getCurrentSidePanelState(),
          reason,
        });
      } catch (error) {
        console.error('[side-panel-state-tracker] Failed to connect:', error);
        scheduleReconnect();
      }
    }

    if (trackDocumentVisibility) {
      handleVisibilityChange = () => {
        setSidePanelState({
          state: getCurrentSidePanelState(),
          reason: 'visibility-change',
        });
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    connectToBackground('document-load');
  });

  // Return cleanup function
  return () => {
    isDisposed = true;
    clearReconnectTimeout();
    if (handleVisibilityChange) {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    const currentPort = port;
    port = undefined;
    currentPort?.disconnect();
    isInitialized = false;
  };
}
