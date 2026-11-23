import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pgmja.dishswapp',
  appName: 'Dishswapp',
  webDir: 'www',
  server: {
    allowNavigation: ['dishswapp.pgmja.com'],
  },
};

export default config;
