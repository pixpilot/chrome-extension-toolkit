import { createMessage } from '@pixpilot/chrome-messenger';
import {
  createMessageEffect,
  createMessageState,
} from '@pixpilot/chrome-messenger/react';

const exampleMessage = createMessage<{ text: string }, boolean>('EXAMPLE');
const exampleEffect = createMessageEffect<{ count: number }, void>('EXAMPLE_EFFECT');
const exampleState = createMessageState<{ value: number }>('EXAMPLE_STATE');

export { exampleEffect, exampleMessage, exampleState };
