import type { IPublicClientApplication } from '@azure/msal-browser';
import type { Page } from '@playwright/test';

export function makeMockGraphProfile(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'e2e-user-oid',
    accountEnabled: true,
    createdDateTime: '2026-01-01T00:00:00.000Z',
    displayName: 'E2E User',
    givenName: 'E2E',
    surname: 'User',
    isLicenseReconciliationNeeded: false,
    mail: 'e2e.user@example.com',
    mailNickname: 'e2euser',
    refreshTokensValidFromDateTime: '2026-01-01T00:00:00.000Z',
    securityIdentifier: 'S-1-5-21-1234567890-123456789-123456789-e2e',
    signInSessionsValidFromDateTime: '2026-01-01T00:00:00.000Z',
    userType: 'Member',
    userPrincipalName: 'e2e.user@example.com',
    extension_example_IsAttorney: true,
    ...overrides,
  };
}

export async function installMockAuthRuntimeDependencies(page: Page) {
  // Register quiet defaults first. Test-specific routes registered afterward take
  // precedence in Playwright, so scenarios can still override any response.
  await page.route('https://graph.microsoft.com/beta/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeMockGraphProfile()),
    }),
  );
  await page.route(
    'https://graph.microsoft.com/beta/me/photo/$value',
    (route) => route.fulfill({ status: 404, body: '' }),
  );
  await page.route('**/api/accounts/notifications/count**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 0 }),
    }),
  );
  await page.route('**/api/realtime/negotiate', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        url: 'wss://example.com/e2e',
        groupName: 'notifications',
      }),
    }),
  );
  await page.route('**/api/accounts/access**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ agreedToTerms: true, isActive: true }),
    }),
  );
  await page.route('**/api/accounts/initialize**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ initialized: true, created: false }),
    }),
  );
  await page.route('**/api/accounts/cases/enable**', (route) =>
    route.fulfill({ status: 204, body: '' }),
  );
  await page.route('**/api/accounts/demo-offer**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ shouldOffer: false }),
    }),
  );
  await page.route('**/api/accounts/cases', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );
  await page.route('**/api/accounts/cases/*/requests?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );

  await page.addInitScript(() => {
    const account = {
      homeAccountId: 'e2e-home',
      environment: 'e2e',
      tenantId: 'e2e-tenant',
      username: 'e2e.user@example.com',
      localAccountId: 'e2e-local',
      name: 'E2E User',
    };

    const authResult = {
      authority: 'https://login.microsoftonline.com/e2e-tenant',
      uniqueId: 'e2e-unique',
      tenantId: 'e2e-tenant',
      scopes: ['openid', 'profile'],
      account,
      idToken: 'e2e-id-token',
      idTokenClaims: {},
      accessToken: 'e2e-token',
      expiresOn: new Date(Date.now() + 60 * 60 * 1000),
      tokenType: 'Bearer',
      fromCache: true,
      correlationId: 'e2e-correlation',
      state: '',
    };

    const callbacks = new Map();
    let activeAccount = account;
    const logger = {
      clone: () => logger,
      info: () => {},
      verbose: () => {},
      warning: () => {},
      error: () => {},
    };

    const baseMsalClient = {
      initializeWrapperLibrary: () => {},
      getLogger: () => logger,
      setLogger: () => {},
      addEventCallback: (cb: unknown) => {
        const id = `e2e-${callbacks.size + 1}`;
        callbacks.set(id, cb);
        return id;
      },
      removeEventCallback: (id: string) => {
        callbacks.delete(id);
      },
      initialize: async () => {},
      handleRedirectPromise: async () => null,
      getActiveAccount: () => activeAccount,
      getAllAccounts: () => [account],
      setActiveAccount: (value: typeof account | null) => {
        activeAccount = value ?? account;
      },
      acquireTokenSilent: async () => authResult,
      loginRedirect: async () => {},
      logoutRedirect: async () => {
        (
          window as typeof window & {
            __PB_LOGOUT_REDIRECT_CALLED__?: boolean;
          }
        ).__PB_LOGOUT_REDIRECT_CALLED__ = true;
      },
    };

    // CI can exercise additional MSAL APIs via msal-react internals.
    // Provide a no-op fallback for any unmocked method to prevent boot-time crashes.
    const msalClient = new Proxy(baseMsalClient as Record<string, unknown>, {
      get(target, property) {
        if (property in target) {
          return target[property as keyof typeof target];
        }
        if (typeof property === 'string') {
          return (...args: unknown[]) => {
            void args;
            return undefined;
          };
        }
        return undefined;
      },
    }) as unknown as IPublicClientApplication;

    const existingRuntimeDependencies = (
      window as typeof window & {
        __PB_RUNTIME_DEPENDENCIES__?: Record<string, unknown>;
      }
    ).__PB_RUNTIME_DEPENDENCIES__;

    const defaultRuntimeDependencies = {
      msalClient,
      createWebPubSubClient: () => ({
        on: () => {},
        start: async () => {},
        joinGroup: async () => {},
      }),
    };

    // Merge instead of overwriting so additional init-script overrides persist.
    window.__PB_RUNTIME_DEPENDENCIES__ = {
      ...defaultRuntimeDependencies,
      ...(existingRuntimeDependencies ?? {}),
    };
  });
}
