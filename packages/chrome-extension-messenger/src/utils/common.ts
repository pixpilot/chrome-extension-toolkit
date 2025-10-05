/**
 * Utility functions for chrome-messenger
 */

import type { Promisified, SendOptions } from '../types';

export function createMessageId(identifier: string): string {
  return `chrome-messenger:${identifier}`;
}

export function isValidMessage(request: unknown, identifier: string): boolean {
  return (
    typeof request === 'object' &&
    request !== null &&
    'identifier' in request &&
    (request as { identifier?: unknown }).identifier === identifier
  );
}

export function createErrorResponse(error: Error): { error: string } {
  return { error: error.message };
}

export function createConditionalSend<Data, ReturnValue>(
  send: (data: Data, options?: SendOptions) => Promise<ReturnValue>,
): (data: Data, options?: SendOptions) => Promisified<ReturnValue> {
  return send as (data: Data, options?: SendOptions) => Promisified<ReturnValue>;
}
