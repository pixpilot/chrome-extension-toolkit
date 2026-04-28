import {
  initSidePanelStateManager,
  onSidePanelStateChange,
} from '@pixpilot/chrome-lifecycle';
import { countBroadcast, countRequest, exampleMessage, tabChange } from '../messages';

console.warn('background is running');

exampleMessage.onMessage((data) => {
  console.warn('background has received a message: ', data.text);
  return true;
});

/*
 * Counter hub: receive a count-change request from any view,
 * then broadcast the confirmed value back to ALL open views.
 * Background is the single relay point — no view talks directly
 * to another view.
 */
countRequest.onMessage((data) => {
  console.warn(`Background: relaying count → ${data.value}`);
  countBroadcast.send({ value: data.value }).catch(console.error);
});

/*
 * Tab change hub: fires whenever the active tab navigates or the user
 * switches to a different tab. Sends tabId + url to all listeners
 * (only SidePanel subscribes in practice).
 */
/*
 * "Receiving end does not exist" is the normal Chrome error when
 * no listener is open (e.g. the SidePanel is closed). We silence
 * that specific case and log everything else.
 */
function isNoListenerError(err: unknown): boolean {
  return (
    err instanceof Error &&
    err.message.toLowerCase().includes('receiving end does not exist')
  );
}

function notifyTabChange(tabId: number, urlFromEvent?: string): void {
  if (urlFromEvent != null && urlFromEvent.length > 0) {
    console.warn(`Background: tab changed → id=${tabId} url=${urlFromEvent}`);
    tabChange.send({ tabId, url: urlFromEvent }).catch((err: unknown) => {
      if (!isNoListenerError(err)) {
        console.error(err);
      }
    });
    return;
  }

  chrome.tabs
    .get(tabId)
    .then((tab) => {
      const url = tab.url ?? tab.pendingUrl ?? '';
      console.warn(`Background: tab changed → id=${tabId} url=${url}`);
      tabChange.send({ tabId, url }).catch((err: unknown) => {
        if (!isNoListenerError(err)) {
          console.error(err);
        }
      });
    })
    .catch(() => {
      // Tab may have been closed before we could read it — ignore.
    });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // Only fire when the URL or status changes to avoid noise.
  if (changeInfo.url != null || changeInfo.status === 'complete') {
    notifyTabChange(tabId, changeInfo.url);
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  notifyTabChange(activeInfo.tabId);
});

initSidePanelStateManager();

onSidePanelStateChange((stateData) => {
  console.warn('Side panel state changed: ', stateData);
});
