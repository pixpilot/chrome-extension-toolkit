export type SidePanelState = 'visible' | 'hidden';

interface BaseSidePanelMessage {
  windowId: number;
  timestamp?: number;
}

export interface SidePanelStateData extends BaseSidePanelMessage {
  type: 'side-panel-heartbeat' | 'side-panel-state-tracker' | 'side-panel-state-open';
  state: SidePanelState;
  reason: string;
}

// Add a new type for listener callbacks (without timestamp)
export interface SidePanelStateChangeData
  extends Omit<SidePanelStateData, 'timestamp' | 'type'> {
  /**
   * The state recorded for this window before this change.
   *
   * `undefined` means nothing was recorded yet: the first event for a window, or
   * the first event after the service worker restarted and lost its state. Use it
   * to tell a real transition apart from a repeat of the state you already knew —
   * the tracker reports the same state more than once (a reconnect while still
   * visible, consecutive visibility changes), so plain state events are not
   * transitions.
   */
  previousState?: SidePanelState;
}

export interface SidePanelClientMessage {
  type: 'close-side-panel';
}
