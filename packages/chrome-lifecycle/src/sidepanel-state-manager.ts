import type {
  SidePanelClientMessage,
  SidePanelState,
  SidePanelStateChangeData,
  SidePanelStateData,
} from './types';

interface BackendSidePanelInfo extends SidePanelStateData {
  port?: chrome.runtime.Port;
}

const sidePanels = new Map<number, BackendSidePanelInfo>();

type SidePanelStateListener = (data: SidePanelStateChangeData) => void;
const listeners = new Set<SidePanelStateListener>();

let isInitialized = false;

/**
 * Ensures the side panel state manager has been initialized.
 *
 * Throws an error if `initSidePanelStateManager()` has not been called.
 *
 * ⚠️ Important: Always call `initSidePanelStateManager()` at the top
 * of your background script before using any other API functions
 * (getSidePanelStateForWindow, isWindowSidePanelVisible, onSidePanelStateChange, etc.).
 */
function ensureInitialized(): void {
  if (!isInitialized) {
    console.error(
      'Side panel state manager is not initialized.',
      'Call initSidePanelStateManager() at the top of your background script before using any other functions.',
    );
  }
}

/**
 * Initializes the side panel state manager.
 * Sets up Chrome event listeners for action clicks and runtime connections.
 * This function should be called once before using other functions in this module.
 * Subsequent calls will log a warning and do nothing.
 */
export function initSidePanelStateManager(): void {
  if (isInitialized) {
    return;
  }

  isInitialized = true;

  // Listen for action click to open side panel
  chrome.action.onClicked.addListener((tab) => {
    const sidePanel = sidePanels.get(tab.windowId);

    if (sidePanel && sidePanel.state === 'visible') {
      if (sidePanel.port) {
        sidePanels.delete(tab.windowId);
        sidePanel.port.postMessage({
          type: 'close-side-panel',
        } satisfies SidePanelClientMessage);
      }
    } else {
      chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
    }
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === chrome.runtime.id) {
      port.onMessage.addListener((msg: SidePanelStateData) => {
        if (msg.type !== 'side-panel-state-tracker') {
          return;
        }

        if (msg.state) {
          setSidePanelState({
            port,
            state: msg.state,
            reason: msg.reason ?? 'unknown',
            windowId: msg.windowId,
            type: msg.type, // Preserve the original message type
          });
        }
      });
      port.onDisconnect.addListener((dPort) => {
        Array.from(sidePanels.entries()).forEach(([windId, info]) => {
          if (info.port && info.port === dPort) {
            setSidePanelState({
              port: undefined,
              state: 'hidden',
              reason: 'port-disconnected',
              windowId: windId,
              type: 'side-panel-state-tracker',
            });
          }
        });
      });
    }
  });
}

/**
 * Notifies all registered listeners about a state change.
 * Only triggers for 'side-panel-state-tracker' type messages.
 * Excludes timestamp from the data passed to listeners.
 */
function notifyListeners(data: BackendSidePanelInfo) {
  // Only notify for state tracker messages, NOT heartbeats
  if (data.type !== 'side-panel-state-tracker') {
    return;
  }

  // Create data object without timestamp
  const listenerData: SidePanelStateChangeData = {
    state: data.state,
    reason: data.reason,
    windowId: data.windowId,
  };

  // Notify all listeners
  listeners.forEach((listener) => {
    try {
      listener(listenerData);
    } catch (error) {
      console.error('Error in side panel state listener:', error);
    }
  });
}

function setSidePanelState(data: BackendSidePanelInfo) {
  const { windowId, state } = data;

  if (state === 'hidden') {
    sidePanels.delete(windowId);
    notifyListeners(data);
    return;
  }

  sidePanels.set(windowId, data);
  notifyListeners(data);
}

export function getSidePanelStateForWindow(windowId: number): SidePanelState | undefined {
  ensureInitialized();

  const sidePanel = sidePanels.get(windowId);
  return sidePanel?.state;
}

export function isWindowSidePanelVisible(windowId: number): boolean {
  ensureInitialized();

  const state = getSidePanelStateForWindow(windowId);
  return state === 'visible';
}

/**
 * Adds a listener for side panel state changes.
 * The listener will be called whenever the side panel state changes (visible/hidden).
 * Note: Heartbeat messages do not trigger listeners, and timestamp is excluded from the data.
 *
 * @param listener - Callback function that receives state change data
 * @returns Unsubscribe function to remove the listener
 */
export function onSidePanelStateChange(listener: SidePanelStateListener): () => void {
  ensureInitialized();

  listeners.add(listener);

  // Return unsubscribe function
  return () => {
    listeners.delete(listener);
  };
}
