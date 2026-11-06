import { expect, test } from '@playwright/test';
import {
  installMockAuthRuntimeDependencies,
  makeMockGraphProfile,
} from './fixtures/auth';

const notificationsCountApi = '**/api/accounts/notifications/count**';
const negotiateApi = '**/api/realtime/negotiate';
const userAccessApi = '**/api/accounts/access**';
const initializeAccountApi = '**/api/accounts/initialize**';
const enableAccountsApi = '**/api/accounts/cases/enable**';
const graphMeApi = 'https://graph.microsoft.com/beta/me';
const graphPhotoApi = 'https://graph.microsoft.com/beta/me/photo/$value';
const caseDetailsApi = /\/api\/accounts\/cases\/[0-9a-fA-F-]{36}$/;
const documentsApi = /\/api\/accounts\/cases\/[0-9a-fA-F-]{36}\/documents(?:\/.*)?/;

function makeCaseDetailsResponse(caseId: string) {
  return {
    id: '10000000-0000-4000-8000-000000000011',
    emailAddresses: ['e2e.user@example.com'],
    oids: ['10000000-0000-4000-8000-000000000012'],
    casesAccounts: [
      {
        accountId: caseId,
        caseNumber: 'CN-E2E-DOCS',
        agreedToCaseTerms: true,
        isGuest: false,
        canGenerateDeclaration: true,
        canUseQA: true,
        canAccessDocuments: true,
      },
    ],
    accountId: '10000000-0000-4000-8000-000000000013',
    agreedToTerms: true,
    isActive: true,
  };
}

function makeDocumentsResponse(caseId: string) {
  const now = '2026-01-01T00:00:00.000Z';

  return {
    d: {
      __metadata: {
        id: `https://example.test/sites/${caseId}/folder`,
        uri: `https://example.test/sites/${caseId}/folder`,
        type: 'SP.Folder',
      },
      Files: {
        results: [],
      },
      Folders: {
        results: [],
      },
      Exists: true,
      ExistsAllowThrowForPolicyFailures: true,
      ExistsWithException: false,
      IsWOPIEnabled: false,
      ItemCount: 0,
      Name: 'Shared Documents',
      ProgID: null,
      ServerRelativeUrl: `/sites/${caseId}/Shared Documents`,
      TimeCreated: now,
      TimeLastModified: now,
      UniqueId: '10000000-0000-4000-8000-000000000014',
      WelcomePage: '',
    },
    baseUrl: 'sharepoint.example.test',
  };
}

test.describe('Document breadcrumbs', () => {
  test.beforeEach(async ({ page }) => {
    await installMockAuthRuntimeDependencies(page);

    await page.route(graphMeApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeMockGraphProfile()),
      }),
    );

    await page.route(graphPhotoApi, (route) =>
      route.fulfill({
        status: 404,
        body: '',
      }),
    );

    await page.route(notificationsCountApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0 }),
      }),
    );

    await page.route(negotiateApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'wss://example.com/e2e',
          groupName: 'notifications',
        }),
      }),
    );

    await page.route(userAccessApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ agreedToTerms: true, isActive: true }),
      }),
    );

    await page.route(initializeAccountApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ initialized: true, created: false }),
      }),
    );

    await page.route(enableAccountsApi, (route) =>
      route.fulfill({
        status: 204,
        body: '',
      }),
    );

    await page.route(caseDetailsApi, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      const url = new URL(route.request().url());
      const caseId = url.pathname.split('/').at(-1);
      if (!caseId) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Missing caseId' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeCaseDetailsResponse(caseId)),
      });
    });

    await page.route(documentsApi, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      const url = new URL(route.request().url());
      const caseId = url.pathname.split('/')[4];
      if (!caseId) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Missing caseId' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeDocumentsResponse(caseId)),
      });
    });
  });

  test('decodes URL-encoded folder names in breadcrumb labels', async ({
    page,
  }) => {
    const caseId = '20000000-0000-4000-8000-000000000021';

    await page.goto(`/cases/${caseId}/documents/root/Client%20Intake%20Forms`);

    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');

    await expect(breadcrumb).toBeVisible();
    await expect(
      breadcrumb.getByRole('link', { name: 'Client Intake Forms' }),
    ).toBeVisible();
    await expect(breadcrumb.getByText('Client%20Intake%20Forms')).toHaveCount(
      0,
    );
  });
});
