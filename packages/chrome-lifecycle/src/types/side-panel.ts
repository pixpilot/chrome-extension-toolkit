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
export type SidePanelStateChangeData = Omit<SidePanelStateData, 'timestamp' | 'type'>;

export interface SidePanelClientMessage {
  type: 'close-side-panel';
}
