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

/**
 * Last state reported for a window, kept separately from `sidePanels` because that
 * map only holds visible panels — it drops the entry on 'hidden' so
 * `getSidePanelStateForWindow` can report "no panel". Transitions need the state we
 * dropped, so it is remembered here until the window goes away.
 */
const lastKnownStates = new Map<number, SidePanelState>();

export type SidePanelStateListener = (data: SidePanelStateChangeData) => void;
const listeners = new Set<SidePanelStateListener>();

let isInitialized = false;

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

  chrome.windows.onRemoved.addListener((windowId) => {
    sidePanels.delete(windowId);
    lastKnownStates.delete(windowId);
  });
}

/**
 * Ensures the side panel state manager has been initialized.
 */
function ensureInitialized() {
  if (!isInitialized) {
    initSidePanelStateManager();
    isInitialized = true;
  }
}

/**
 * Notifies all registered listeners about a state change.
 * Only triggers for 'side-panel-state-tracker' type messages.
 * Excludes timestamp from the data passed to listeners.
 */
function notifyListeners(
  data: BackendSidePanelInfo,
  previousState: SidePanelState | undefined,
) {
  // Only notify for state tracker messages, NOT heartbeats
  if (data.type !== 'side-panel-state-tracker') {
    return;
  }

  // Create data object without timestamp
  const listenerData: SidePanelStateChangeData = {
    state: data.state,
    reason: data.reason,
    windowId: data.windowId,
    previousState,
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
  const previousState = lastKnownStates.get(windowId);

  // Heartbeats are not state reports, so they must not shift the transition
  // baseline that `onSidePanelShown` / `onSidePanelHidden` compare against.
  if (data.type === 'side-panel-state-tracker') {
    lastKnownStates.set(windowId, state);
  }

  if (state === 'hidden') {
    sidePanels.delete(windowId);
    notifyListeners(data, previousState);
    return;
  }

  sidePanels.set(windowId, data);
  notifyListeners(data, previousState);
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

/**
 * Adds a listener that fires only when a side panel *becomes* visible, skipping
 * repeats of a state you already knew about.
 *
 * This is the event to use for "the panel is back on screen, resync it". It covers
 * a freshly loaded document (`reason: 'document-load'`), a panel Chrome had cached
 * while another extension's side panel took over the slot
 * (`reason: 'visibility-change'`), and the first report after a service worker
 * restart (`reason: 'reconnected'`).
 *
 * @param listener - Callback function that receives state change data
 * @returns Unsubscribe function to remove the listener
 */
export function onSidePanelShown(listener: SidePanelStateListener): () => void {
  return onSidePanelStateChange((data) => {
    if (data.state === 'visible' && data.previousState !== 'visible') {
      listener(data);
    }
  });
}

/**
 * Adds a listener that fires only when a side panel *stops* being visible, skipping
 * repeats of a state you already knew about.
 *
 * Nothing fires for a window that was never seen visible, so a service worker
 * restart followed by a port disconnect stays quiet instead of reporting a close
 * that the listener never saw open.
 *
 * @param listener - Callback function that receives state change data
 * @returns Unsubscribe function to remove the listener
 */
export function onSidePanelHidden(listener: SidePanelStateListener): () => void {
  return onSidePanelStateChange((data) => {
    if (data.state === 'hidden' && data.previousState === 'visible') {
      listener(data);
    }
  });
}
