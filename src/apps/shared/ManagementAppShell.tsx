import React from 'react';
import { B2BProvider } from '../../context/B2BContext';
import { ScrollToTopButton } from './components/common/ScrollToTopButton';
import { AppErrorBoundary } from './AppErrorBoundary';

export const ManagementAppShell: React.FC<React.PropsWithChildren> = ({ children }) => (
  <B2BProvider>
    <ScrollToTopButton />
    <AppErrorBoundary>{children}</AppErrorBoundary>
  </B2BProvider>
);
