export function getBrowserEnv(): typeof chrome | undefined {
  if (typeof chrome !== 'undefined') {
    return chrome;
  }
  // Check if browser exists in globalThis and return it
  if ('browser' in globalThis && Boolean((globalThis as any).browser)) {
    return (globalThis as any).browser;
  }
  return undefined;
}
