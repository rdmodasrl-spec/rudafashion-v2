import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fashion.ruda.app',
  appName: 'RUDA Fashion',
  webDir: 'dist',
  server: {
    // The first native release uses the production PWA as its authenticated shell.
    // This preserves the existing merchant/employee sessions while native features
    // are introduced incrementally.
    url: process.env.CAPACITOR_SERVER_URL || 'https://ruda.fashion',
    cleartext: false,
    allowNavigation: ['ruda.fashion', '*.ruda.fashion']
  },
  android: {
    backgroundColor: '#ffffff'
  },
  ios: {
    backgroundColor: '#ffffff',
    contentInset: 'automatic'
  }
};

export default config;
