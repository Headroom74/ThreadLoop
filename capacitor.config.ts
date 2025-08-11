import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.threadloop.app',
  appName: 'ThreadLoop',
  webDir: 'dist',
  bundledWebRuntime: false,
  ios: {
    contentInset: 'always',
    allowsLinkPreview: false,
    limitsNavigationsToAppBoundDomains: false
  },
};

export default config;
