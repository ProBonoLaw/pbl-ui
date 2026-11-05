import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const workers = process.env.PLAYWRIGHT_WORKERS
  ? Number(process.env.PLAYWRIGHT_WORKERS)
  : 1;

export default defineConfig({
  testDir: './tests/playwright',
  fullyParallel: true,
  // Keep the dev server's cold route compilation deterministic. Set
  // PLAYWRIGHT_WORKERS explicitly when running against a prebuilt server.
  workers,
  retries: isCI ? 1 : 0,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'bun run dev',
        port: 3000,
        reuseExistingServer: !isCI,
        timeout: 120_000,
        // Use the same mock authentication settings as CI for local UI tests.
        env: {
          NEXT_PUBLIC_AAD_TENANT_ID: 'e2e-tenant',
          NEXT_PUBLIC_AAD_CLIENT_ID: 'e2e-client',
          NEXT_PUBLIC_AAD_REDIRECT_URI: baseURL,
          NEXT_PUBLIC_AAD_API_SCOPE: 'openid,profile',
          NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@example.test',
          AZURE_AD_AUDIENCE: 'e2e-audience',
          APPLICATIONINSIGHTS_DISABLED: 'true',
          NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING: '',
          LEGAL_DOCUMENT_ARCHIVE_PATH: 'archives/TermsAndAgreements.zip',
        },
      },
});
