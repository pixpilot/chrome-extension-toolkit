# @pixpilot/chrome-lifecycle

## 0.10.0

### Minor Changes

- make onSidePanelStateChange report state changes only

## 0.9.0

### Minor Changes

- add onSidePanelShown and onSidePanelHidden transition helpers
- d2199c3: Add `onSidePanelShown` and `onSidePanelHidden` for side panel visibility transitions.

  `onSidePanelStateChange` fires for every state report, including repeats of a state
  the listener already knew about — a reconnect while still visible, or a visibility
  change followed by a port disconnect. Every consumer that wanted "the panel just
  came back, resync it" had to keep its own `Map<windowId, state>` to dedupe.

  State change data now carries `previousState`, and the two new helpers filter on it:

  ```typescript
  onSidePanelShown(({ windowId }) => refreshPanelContents(windowId));
  ```

  This matters when another extension's side panel takes over the slot. Chrome keeps
  the hidden document alive rather than tearing it down, so returning to your panel
  reports `visibility-change`, not `document-load` — a listener keyed on
  `document-load` serves stale content instead of refreshing.

## 0.8.0

### Minor Changes

- enhance state tracking and reconnection logic

### Patch Changes

- remove unnecessary dependencies from tasks

## 0.7.0

### Minor Changes

- update code to initialize using ensureInitialized

## 0.6.0

### Minor Changes

- add dependency and initialize state managers

### Patch Changes

- change error throwing to console logging in ensureInitialized

## 0.5.0

### Minor Changes

- remove unused `SidePanelTabTypes` type

## 0.4.0

### Minor Changes

- export `types` module

## 0.3.0

### Minor Changes

- export side-panel-state-tracker module

## 0.2.0

### Minor Changes

- implement side panel state management

## 0.1.1

### Patch Changes

- enhance usage instructions for onWindowClose

## 0.1.0

### Minor Changes

- rename chrome-utils to chrome-lifecycle
