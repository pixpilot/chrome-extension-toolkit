/**
 * Core types for chrome-messenger library
 */

import MessageSender = chrome.runtime.MessageSender;

export interface SendOptions {
  tabId?: number;
  extensionId?: string;
  windowId?: number;
}

export interface MessageDisposer {
  (): void;
}

export type MessageHandler<Data, ReturnValue> = (
  data: Data,
  sender: MessageSender,
) => Promise<ReturnValue> | ReturnValue;

export type MessageSubscriber<Data, ReturnValue> = (
  handler: MessageHandler<Data, ReturnValue>,
) => MessageDisposer;

// Type helper to detect if ReturnValue is a Promise type
export type IsPromise<T> = T extends Promise<any> ? true : false;

// Type helper to unwrap Promise type if it exists
export type Awaited<T> = T extends Promise<infer U> ? U : T;

// Always return Promise, but unwrap if ReturnValue is already Promise to avoid Promise<Promise<T>>
export type Promisified<ReturnValue> = Promise<Awaited<ReturnValue>>;

// React-specific types
export interface ReactMessageHook<Data, ReturnValue> {
  send: (data: Data, options?: SendOptions) => Promisified<ReturnValue>;
  isConnected: boolean;
}

export interface ReactMessageState<Data> {
  lastMessage: Data | null;
  messageCount: number;
  isConnected: boolean;
}

export interface ReactMessageListener<Data> {
  state: ReactMessageState<Data>;
  dispose: MessageDisposer;
}

export interface MessageStateUtils<Data> {
  setState: (state: Data) => void;
  clearState: () => void;
}

/**
 * Common types for React hooks
 */
export type MessagesHookReturn<Data> = [Data, MessageStateUtils<Data>];

export type ExternalSendFunction<Data, ReturnValue> = (
  extensionId: string,
  data: Data,
) => Promisified<ReturnValue>;

export type ExternalSendRawFunction<Data, ReturnValue> = (
  extensionId: string,
  data: Data,
) => Promise<ReturnValue>;
