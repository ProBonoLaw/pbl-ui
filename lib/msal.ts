import {
  EventType,
  PublicClientApplication,
  RedirectRequest,
  type Configuration,
} from '@azure/msal-browser';

const tenantId = process.env.NEXT_PUBLIC_AAD_TENANT_ID || '';
const clientId = process.env.NEXT_PUBLIC_AAD_CLIENT_ID || '';
const redirectUri = process.env.NEXT_PUBLIC_AAD_REDIRECT_URI;

export const msalConfig: Configuration = {
  auth: {
    clientId: clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: redirectUri,
    postLogoutRedirectUri: process.env.NEXT_PUBLIC_AAD_REDIRECT_URI,
  },
  cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false },
};

export const msalInstance = new PublicClientApplication(msalConfig);

// Ensure we only initialize once
let initialized = false;
export async function ensureMsalInitialized() {
  if (!initialized) {
    await msalInstance.initialize(); // <-- REQUIRED on MSAL v3
    msalInstance.addEventCallback((event) => {
      if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
        const account = (event.payload as RedirectRequest).account!;
        msalInstance.setActiveAccount(account);
      }
    });
    initialized = true;
  }
  return msalInstance;
}
