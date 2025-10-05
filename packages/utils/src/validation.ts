/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    const result = new URL(url);
    return Boolean(result);
  } catch {
    return false;
  }
}

/**
 * Check if a string is empty or contains only whitespace
 */
export function isEmptyString(str: string): boolean {
  return !str || str.trim().length === 0;
}
