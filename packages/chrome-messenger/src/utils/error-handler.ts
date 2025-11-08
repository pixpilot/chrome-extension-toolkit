import type { SendOptions } from '../types';

/**
 * Categorized Chrome error with helpful context
 */
export interface ChromeError {
  code: string;
  reason: string;
  solution: string;
  includes: string[];
}

/**
 * Known Chrome error patterns with helpful context
 */
const CHROME_ERROR_PATTERNS: ChromeError[] = [
  {
    code: 'NO_RECEIVER',
    reason: 'No listener registered for this message',
    solution: 'Ensure the target script is loaded and onMessage listener is registered',
    includes: ['receiving end does not exist', 'could not establish connection'],
  },
  {
    code: 'TAB_UNAVAILABLE',
    reason: 'Tab is closed or page is restricted',
    solution:
      'Check tab exists before sending, or verify permissions for chrome:// pages',
    includes: [
      'tab was closed',
      'no tab with id',
      'cannot access contents of',
      'cannot access a chrome://',
      'cannot access chrome-extension://',
    ],
  },
  {
    code: 'CONTEXT_INVALIDATED',
    reason: 'Extension was reloaded, updated, or disabled',
    solution: 'Reload the page or restart the extension',
    includes: [
      'extension context invalidated',
      'cannot access a chrome extension context',
      'extension has been reloaded or disabled',
    ],
  },
  {
    code: 'PERMISSION_DENIED',
    reason: 'Missing required permissions',
    solution: 'Add necessary permissions to manifest.json',
    includes: [
      'requires permission',
      'access is forbidden',
      'this operation is not allowed',
    ],
  },
  {
    code: 'PORT_DISCONNECTED',
    reason: 'Message port was closed before response',
    solution: 'Check if the other end disconnected or use sendMessage instead',
    includes: [
      'message port closed',
      'port has been disconnected',
      'attempting to use a disconnected port',
    ],
  },
];

/**
 * Analyzes Chrome runtime error messages and returns helpful context
 */
export function categorizeRuntimeError(errorMessage: string): ChromeError {
  const message = errorMessage.toLowerCase();

  // Find matching error pattern
  for (const pattern of CHROME_ERROR_PATTERNS) {
    if (pattern.includes.some((keyword) => message.includes(keyword))) {
      return pattern;
    }
  }

  // Generic runtime error
  return {
    code: 'RUNTIME_ERROR',
    reason: 'Chrome runtime error occurred',
    solution: 'Check console for details',
    includes: [],
  };
}

/**
 * Creates a detailed error message with context, reason, and solution
 */
export function createDetailedErrorMessage(
  identifier: string,
  error: ChromeError | { code: string; reason: string; solution: string },
  originalErrorMessage: string,
  options?: SendOptions,
): string {
  // Determine the target of the message
  let target = 'runtime';
  if (options?.tabId != null) {
    target = `tab ${options.tabId}`;
  } else if (options?.extensionId) {
    target = `extension ${options.extensionId}`;
  }

  const parts = [
    `[chrome-messenger] Failed to send "${identifier}" to ${target}`,
    `Reason: ${error.reason}`,
    `Solution: ${error.solution}`,
    `Original: ${originalErrorMessage}`,
  ];

  return parts.join('\n');
}
