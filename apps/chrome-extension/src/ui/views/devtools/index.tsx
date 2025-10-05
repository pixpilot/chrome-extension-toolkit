import React from 'react';
import ReactDOM from 'react-dom/client';
import { ViewProvider } from '../../components/ViewProvider';

import { DevTools } from './DevTools';
import './index.css';

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <ViewProvider>
    <DevTools />
  </ViewProvider>,
);

chrome.devtools.panels.create('ReactCrx', '', '../../devtools.html', () => {
  console.warn('devtools panel create');
});
