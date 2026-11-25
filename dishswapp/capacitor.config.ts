import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pgmja.dishswapp',
  appName: 'Dishswapp',
  webDir: 'www',
  server: {
    url: 'https://dishswapp.pgmja.com',
    cleartext: true,
    // Keep the whole sign-in flow inside the app: Clerk and Google redirect through
    // these hosts, and any host not listed is handed off to the system browser.
    allowNavigation: ['dishswapp.pgmja.com', 'clerk.dishswapp.pgmja.com', 'accounts.google.com'],
  },
};

export default config;
