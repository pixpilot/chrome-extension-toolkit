import { createMessage } from 'chrome-extension-messenger';
import {
  createMessageEffect,
  createMessageState,
} from 'chrome-extension-messenger/react';

const exampleMessage = createMessage<{ text: string }, boolean>('EXAMPLE');
const exampleEffect = createMessageEffect<{ count: number }, void>('EXAMPLE_EFFECT');
const exampleState = createMessageState<{ value: number }>('EXAMPLE_STATE');

export { exampleEffect, exampleMessage, exampleState };
