import { createMessage } from '@pixpilot/chrome-messenger';
import {
  createMessageEffect,
  createMessageState,
} from '@pixpilot/chrome-messenger/react';

const exampleMessage = createMessage<{ text: string }, boolean>('EXAMPLE');
const exampleEffect = createMessageEffect<{ count: number }, void>('EXAMPLE_EFFECT');
const exampleState = createMessageState<{ value: number }>('EXAMPLE_STATE');

/*
 * Counter hub messages.
 * countRequest  — any view → background: "please change count to X"
 * countBroadcast — background → all views: "count is now X (confirmed)"
 */
const countRequest = createMessage<{ value: number }, void>('COUNT_REQUEST');
const countBroadcast = createMessageEffect<{ value: number }, void>('COUNT_BROADCAST');

/*
 * Tab change notification.
 * Sent exclusively by background whenever the active tab updates.
 * Only the SidePanel subscribes to this; other views ignore it.
 */
const tabChange = createMessageEffect<{ tabId: number; url: string }, void>('TAB_CHANGE');

export {
  countBroadcast,
  countRequest,
  exampleEffect,
  exampleMessage,
  exampleState,
  tabChange,
};
