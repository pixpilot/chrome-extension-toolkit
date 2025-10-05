import type {
  ExternalSendFunction,
  ExternalSendRawFunction,
  MessageHandler,
  MessageSubscriber,
  Promisified,
  SendOptions,
} from './types';
import {
  createConditionalSend,
  getBrowserEnv,
  handleWindowFilterWithManualResponse,
  isValidMessage,
  makeSend,
} from './utils';
import MessageSender = chrome.runtime.MessageSender;

function makeMessageListener<Data, ReturnValue>(
  identifier: string,
  handler: MessageHandler<Data, ReturnValue>,
) {
  return (
    request: any,
    sender: MessageSender,
    nativeSendResponse: (response: any) => void,
  ): boolean | undefined => {
    if (!isValidMessage(request, identifier)) {
      return undefined;
    }

    // Handle windowId filtering
    const { options } = request as { options?: SendOptions };

    if (options?.windowId != null) {
      return handleWindowFilterWithManualResponse(
        options,
        () => {
          processMessage();
        },
        () => {
          nativeSendResponse(undefined);
        },
      );
    }

    return processMessage();

    function processMessage(): boolean {
      // eslint-disable-next-line prefer-destructuring
      const data = (request as { data: Data }).data;

      try {
        const result = handler(data, sender);

        // Handle async handlers
        if (result instanceof Promise) {
          result
            .then((response) => {
              nativeSendResponse(response);
            })
            .catch((error) => {
              console.error(`Error in message handler for ${identifier}:`, error);
              nativeSendResponse({ error: (error as Error).message });
            });
          return true; // Keep message channel open
        }
        // Handle sync handlers
        nativeSendResponse(result);
        return true;
      } catch (error) {
        console.error(`Error in message handler for ${identifier}:`, error);
        nativeSendResponse({ error: (error as Error).message });
        return true;
      }
    }
  };
}

// Create wrapped external send function that matches the conditional return type
function createConditionalExternalSend<Data, ReturnValue>(
  send: ExternalSendRawFunction<Data, ReturnValue>,
): ExternalSendFunction<Data, ReturnValue> {
  return send as ExternalSendFunction<Data, ReturnValue>;
}

export function createMessage<Data, ReturnValue = void>(
  identifier: string,
): {
  send: (data: Data, options?: SendOptions) => Promisified<ReturnValue>;
  onMessage: MessageSubscriber<Data, ReturnValue>;
} {
  const send = makeSend(identifier)<Data, ReturnValue>;
  const listeners = new Set<any>();

  const onMessage = (handler: MessageHandler<Data, ReturnValue>) => {
    const env = getBrowserEnv();
    if (!env) throw new Error('Browser environment not available');
    const listener = makeMessageListener(identifier, handler);

    listeners.add(listener);
    env.runtime.onMessage.addListener(listener);

    // Return dispose function
    return () => {
      listeners.delete(listener);
      env.runtime.onMessage.removeListener(listener);
    };
  };

  return { send: createConditionalSend(send), onMessage };
}

export function createExternalMessage<Data, ReturnValue = void>(
  identifier: string,
): {
  send: ExternalSendFunction<Data, ReturnValue>;
  onMessage: MessageSubscriber<Data, ReturnValue>;
} {
  const send = makeSend(identifier)<Data, ReturnValue>;

  const onMessage = (handler: MessageHandler<Data, ReturnValue>) => {
    const env = getBrowserEnv();
    if (!env) throw new Error('Browser environment not available');
    const listener = makeMessageListener(identifier, handler);
    env.runtime.onMessageExternal.addListener(listener);

    // Return dispose function
    return () => {
      env.runtime.onMessageExternal.removeListener(listener);
    };
  };

  const externalSend = async (extensionId: string, data: Data) =>
    send(data, { extensionId });

  return { send: createConditionalExternalSend(externalSend), onMessage };
}

// Re-export types for external usage
export type {
  MessageDisposer,
  MessageHandler,
  MessageSubscriber,
  Promisified,
  SendOptions,
} from './types';
