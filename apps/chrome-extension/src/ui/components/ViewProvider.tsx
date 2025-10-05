import { appConfig } from '@internal/configs';
import { ThemeProvider } from '@internal/ui';
import React from 'react';

export interface ViewProviderProps extends React.PropsWithChildren {}

const ViewProvider: React.FC<ViewProviderProps> = (props) => {
  const { children } = props;

  return (
    <React.StrictMode>
      <ThemeProvider defaultTheme={appConfig.theme.defaultTheme}>
        {children}
      </ThemeProvider>
    </React.StrictMode>
  );
};

ViewProvider.displayName = 'ViewProvider';

export { ViewProvider };
