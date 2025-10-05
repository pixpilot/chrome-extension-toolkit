console.warn('background is running');

chrome.runtime.onMessage.addListener((request: { type: string; count?: number }) => {
  if (request.type === 'COUNT') {
    console.warn(
      'background has received a message from popup, and count is ',
      request.count,
    );
  }
});
