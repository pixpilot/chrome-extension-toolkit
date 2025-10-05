import React from 'react';
import ReactDOM from 'react-dom/client';
import { ViewProvider } from '../../components/ViewProvider';

import { NewTab } from './NewTab';
import './index.css';

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <ViewProvider>
    <NewTab />
  </ViewProvider>,
);
