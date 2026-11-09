import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android wrapper configuration (phase 2). Build the web app first (`npm run build`),
 * then `npm run android:add` once and `npm run android:sync` after every build.
 */
const config: CapacitorConfig = {
  appId: 'com.elie55.nineheavens',
  appName: 'Nine Heavens',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#070e0f',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#070e0f',
      showSpinner: false,
    },
  },
};

export default config;
