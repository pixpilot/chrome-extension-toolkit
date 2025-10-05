import React from 'react';
import ReactDOM from 'react-dom/client';
import { ViewProvider } from '../../components/ViewProvider';
import { SidePanel } from './SidePanel';

import './index.css';

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <ViewProvider>
    <SidePanel />
  </ViewProvider>,
);
