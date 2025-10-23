/**
 * React message hooks for chrome-messenger
 */

import type {
  MessagesHookReturn,
  MessageStateUtils,
  Promisified,
  SendOptions,
} from '../types';

import { useEffect, useMemo, useState } from 'react';
import { createMessage } from '../chrome-messenger';

/**
 * Creates a message sender and React hook for listening
 * @param identifier - Unique identifier for the message channel
 * @returns [sender, hook] - sender can be called anywhere, hook is React-only
 */
export function createMessageState<Data, ReturnValue = void>(
  identifier: string,
): {
  send: (data: Data, options?: SendOptions) => Promisified<ReturnValue>;
  useMessage: (defaultValue?: Data) => MessagesHookReturn<Data>;
} {
  // Use the existing chrome-messenger logic
  const { send, onMessage } = createMessage<Data, ReturnValue>(identifier);

  // Create the React hook for listening (React components only)
  const useMessage = (defaultValue?: Data): MessagesHookReturn<Data> => {
    const [messages, setMessages] = useState<Data>(defaultValue as unknown as Data);

    const stateUtils = useMemo<MessageStateUtils<Data>>(
      () => ({
        setState: (state: Data) => {
          setMessages(state);
        },
        clearState: () => {
          setMessages(defaultValue as unknown as Data);
        },
      }),
      [defaultValue],
    );

    useEffect(() => {
      // Use the existing onMessage handler
      const dispose = onMessage((data) => {
        setMessages(data);
        // Return undefined for state updates (no response needed)
        return undefined as ReturnValue;
      });

      return dispose;
    }, []);

    return [messages, stateUtils];
  };

  return { send, useMessage };
}
