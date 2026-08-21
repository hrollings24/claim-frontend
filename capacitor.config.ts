import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Must match the custom URL scheme Cognito already accepts as a callback
  // (com.claiminfrastructure.claimfrontend://callback, see claim-infrastructure/cognito.tf) —
  // that scheme is what lets the login sheet hand control back to the app.
  appId: 'com.claiminfrastructure.claimfrontend',
  appName: 'Claim',
  webDir: 'www',
};

export default config;
