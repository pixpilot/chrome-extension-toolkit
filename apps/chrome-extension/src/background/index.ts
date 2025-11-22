import {
  initSidePanelStateManager,
  onSidePanelStateChange,
} from '@pixpilot/chrome-lifecycle';
import { exampleMessage } from '../messages';

console.warn('background is running');

exampleMessage.onMessage((data) => {
  console.warn('background has received a message: ', data.text);
  return true;
});

initSidePanelStateManager();

onSidePanelStateChange((stateData) => {
  console.warn('Side panel state changed: ', stateData);
});
