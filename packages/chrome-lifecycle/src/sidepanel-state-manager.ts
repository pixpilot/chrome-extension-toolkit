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

export interface SidePanelStateChangeOptions {
  /**
   * Also deliver reports that repeat a state already known for that window — a
   * reconnect while still visible, or a `port-disconnected` after the panel
   * already reported itself hidden.
   *
   * Off by default, so listeners see state *changes*. Turn it on to observe the
   * raw tracker feed, e.g. to tell "the document died" apart from "the document
   * was hidden" when both arrive as `hidden`.
   *
   * @default false
   */
  includeRepeats?: boolean;
}

interface ListenerEntry {
  listener: SidePanelStateListener;
  includeRepeats: boolean;
}

const listeners = new Set<ListenerEntry>();

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
 * Notifies registered listeners about a state change.
 * Only triggers for 'side-panel-state-tracker' type messages.
 * Excludes timestamp from the data passed to listeners.
 *
 * Reports that repeat the state already known for the window reach only listeners
 * that opted into them.
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

  const isRepeat = data.state === previousState;

  // Notify all listeners
  listeners.forEach(({ listener, includeRepeats }) => {
    if (isRepeat && !includeRepeats) {
      return;
    }

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
 *
 * The listener is called when a window's side panel state actually changes. The
 * tracker reports the same state more than once — it re-reports `visible` when it
 * reconnects to a restarted service worker, and a panel can report `hidden` twice
 * (a visibility change, then a port disconnect) — and those repeats are filtered
 * out unless {@link SidePanelStateChangeOptions.includeRepeats} is set.
 *
 * Note: Heartbeat messages do not trigger listeners, and timestamp is excluded from the data.
 *
 * @param listener - Callback function that receives state change data
 * @param options - Delivery options
 * @returns Unsubscribe function to remove the listener
 */
export function onSidePanelStateChange(
  listener: SidePanelStateListener,
  options: SidePanelStateChangeOptions = {},
): () => void {
  ensureInitialized();

  const entry: ListenerEntry = {
    listener,
    includeRepeats: options.includeRepeats === true,
  };

  listeners.add(entry);

  // Return unsubscribe function
  return () => {
    listeners.delete(entry);
  };
}

/**
 * Adds a listener that fires only when a side panel *becomes* visible.
 *
 * A narrowed {@link onSidePanelStateChange} for code that only cares about one
 * direction. This is the event to use for "the panel is back on screen, resync
 * it". It covers a freshly loaded document (`reason: 'document-load'`) and a panel
 * Chrome had cached while another extension's side panel took over the slot
 * (`reason: 'visibility-change'`).
 *
 * Reconnects (`reason: 'reconnected'`) are not shows and never fire this. The
 * tracker reconnects when the service worker is torn down and restarted, and the
 * panel document lives through that untouched — nothing appeared, so nothing needs
 * resyncing. It has to be excluded explicitly because a restarted worker has no
 * record of the window, leaving `previousState` empty, which would otherwise make
 * every recycle look like a fresh show.
 *
 * @param listener - Callback function that receives state change data
 * @returns Unsubscribe function to remove the listener
 */
export function onSidePanelShown(listener: SidePanelStateListener): () => void {
  return onSidePanelStateChange((data) => {
    if (data.reason === 'reconnected') {
      return;
    }

    if (data.state === 'visible' && data.previousState !== 'visible') {
      listener(data);
    }
  });
}

/**
 * Adds a listener that fires only when a side panel *stops* being visible.
 *
 * A narrowed {@link onSidePanelStateChange} for code that only cares about one
 * direction. Nothing fires for a window that was never seen visible, so a service worker
 * restart followed by a port disconnect stays quiet instead of reporting a close
 * that the listener never saw open. Reconnects are excluded for the same reason
 * they are in {@link onSidePanelShown}: they report the state the panel is already
 * in, not a move into it.
 *
 * @param listener - Callback function that receives state change data
 * @returns Unsubscribe function to remove the listener
 */
export function onSidePanelHidden(listener: SidePanelStateListener): () => void {
  return onSidePanelStateChange((data) => {
    if (data.reason === 'reconnected') {
      return;
    }

    if (data.state === 'hidden' && data.previousState === 'visible') {
      listener(data);
    }
  });
}
