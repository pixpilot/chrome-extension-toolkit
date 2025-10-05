/**
 * React message effect hooks for chrome-messenger
 */

import type { MessageHandler, Promisified, SendOptions } from '../types';

import { useEffect, useRef } from 'react';
import { createMessage } from '../chrome-messenger';

/**
 * Creates a message effect hook that listens for messages
 * @param identifier - Message identifier
 * @returns [send, useMessageEffect] - sender function and listener hook
 */
export function createMessageEffect<Data, ReturnValue = void>(
  identifier: string,
): {
  send: (data: Data, options?: SendOptions) => Promisified<ReturnValue>;
  useMessageEffect: (
    callback: MessageHandler<Data, ReturnValue>,
    deps?: React.DependencyList,
  ) => void;
} {
  // Use the existing chrome-messenger logic
  const { send, onMessage } = createMessage<Data, ReturnValue>(identifier);

  // Create the message effect hook
  const useMessageEffect = (
    callback: MessageHandler<Data, ReturnValue>,
    deps?: React.DependencyList,
  ): void => {
    const callbackRef = useRef(callback);

    // Update callback ref when it changes
    useEffect(() => {
      callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
      // Use the existing onMessage handler
      const dispose = onMessage((data, sender): ReturnValue | Promise<ReturnValue> =>
        callbackRef.current(data, sender),
      );

      return dispose;
    }, deps || []);
  };

  return { send, useMessageEffect };
}
