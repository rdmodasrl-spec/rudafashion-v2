import React from 'react';
import { createRoot } from 'react-dom/client';
import type { RudaAppTarget } from '../appTarget';

export function mountApp(target: RudaAppTarget, app: React.ReactNode) {
  document.documentElement.dataset.rudaApp = target;
  const root = document.getElementById('root');
  if (!root) throw new Error('RUDA_APP_ROOT_MISSING');
  root.dataset.rudaApp = target;
  createRoot(root).render(<React.StrictMode>{app}</React.StrictMode>);
}
