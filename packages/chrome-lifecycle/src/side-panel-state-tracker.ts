import type { SidePanelClientMessage, SidePanelStateData } from './types';

const HEARTBEAT_INTERVAL_MS = 15000; // 15 seconds as recommended by Chrome docs

let isInitialized = false;

/**
 * Should only be called inside a Chrome extension side panel page.
 */
export function initializeSidePanelStateTracker(): () => void {
  if (isInitialized) {
    console.warn('Side panel state tracker already initialized');
  }
  isInitialized = true;

  let port: chrome.runtime.Port | undefined;
  let heartbeatInterval: number | undefined;
  let handleVisibilityChange: (() => void) | undefined;

  chrome.windows.getCurrent((win) => {
    if (win.id == null) {
      console.error('[side-panel-state-tracker] Could not get window ID');
      return;
    }

    port = chrome.runtime.connect({ name: chrome.runtime.id });
    const windowId = win.id;

    function setSidePanelState(
      state: Omit<SidePanelStateData, 'port' | 'windowId' | 'type'>,
    ) {
      try {
        port!.postMessage({
          ...state,
          windowId,
          type: 'side-panel-state-tracker',
          timestamp: Date.now(),
        } as SidePanelStateData);
      } catch (error) {
        console.error('[side-panel-state-tracker] Failed to send message:', error);
      }
    }

    // Send periodic heartbeat to keep port alive (every 15 seconds)
    heartbeatInterval = setInterval(() => {
      try {
        port!.postMessage({
          type: 'side-panel-heartbeat',
          windowId,
          timestamp: Date.now(),
        } as SidePanelStateData);
      } catch (error) {
        console.error('[side-panel-state-tracker] Heartbeat failed:', error);
        if (heartbeatInterval) clearInterval(heartbeatInterval);
      }
    }, HEARTBEAT_INTERVAL_MS);

    handleVisibilityChange = () => {
      setSidePanelState({
        state: document.hidden ? 'hidden' : 'visible',
        reason: 'visibility-change',
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    port.onDisconnect.addListener(() => {
      console.warn('[side-panel-state-tracker] Background connection lost');
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    });

    port.onMessage.addListener((message: SidePanelClientMessage) => {
      if (message.type === 'close-side-panel') {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        window.close();
      }
    });

    setSidePanelState({
      state: document.hidden ? 'hidden' : 'visible',
      reason: 'document-load',
    });
  });

  // Return cleanup function
  return () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (handleVisibilityChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (port) port.disconnect();
    isInitialized = false;
  };
}
