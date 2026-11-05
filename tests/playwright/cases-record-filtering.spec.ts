import { test, expect } from '@playwright/test';
import {
  installMockAuthRuntimeDependencies,
  makeMockGraphProfile,
} from './fixtures/auth';

const casesApi = '**/api/accounts/cases';
const notificationsCountApi = '**/api/accounts/notifications/count**';
const negotiateApi = '**/api/realtime/negotiate';
const userAccessApi = '**/api/accounts/access**';
const initializeAccountApi = '**/api/accounts/initialize**';
const enableAccountsApi = '**/api/accounts/cases/enable**';
const graphMeApi = 'https://graph.microsoft.com/beta/me';

function makeCaseWithRecord(accountId: string, firstName: string) {
  return {
    accountId,
    caseNumber: `CN-${firstName}`,
    agreedToCaseTerms: true,
    isGuest: false,
    canGenerateDeclaration: true,
    canUseQA: true,
    canAccessDocuments: true,
    record: {
      accountId,
      type: 'ACCOUNT_DETAILS',
      caseNumber: `CN-${firstName}`,
      personInformation: {
        firstName,
        lastName: 'Client',
        emailAddress: `${firstName.toLowerCase()}@example.com`,
      },
      filingRole: 'Plaintiff',
      state: 'WA',
      county: 'King',
      description: `Case for ${firstName}`,
      opposition: {
        firstName: 'Other',
        lastName: 'Party',
        filingRole: 'Defendant',
      },
    },
  };
}

function makeCaseWithoutRecord(accountId: string, caseNumber: string) {
  return {
    accountId,
    caseNumber,
    agreedToCaseTerms: true,
    isGuest: false,
    canGenerateDeclaration: true,
    canUseQA: true,
    canAccessDocuments: true,
  };
}

function makeCasesResponse(casesAccounts: Array<Record<string, unknown>>) {
  return [
    {
      id: '10000000-0000-4000-8000-000000000001',
      emailAddresses: ['e2e.user@example.com'],
      oids: ['10000000-0000-4000-8000-000000000002'],
      casesAccounts,
      accountId: '00000000-0000-0000-0000-000000000000',
      agreedToTerms: true,
      isActive: true,
    },
  ];
}

test.describe('Case record filtering', () => {
  test.beforeEach(async ({ page }) => {
    await installMockAuthRuntimeDependencies(page);

    await page.route(graphMeApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeMockGraphProfile()),
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
  });

  test('Case Explorer filters out entries without records', async ({
    page,
  }) => {
    const visibleCaseId = '20000000-0000-4000-8000-000000000001';
    const missingRecordCaseId = '20000000-0000-4000-8000-000000000002';

    await page.route(casesApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          makeCasesResponse([
            makeCaseWithRecord(visibleCaseId, 'Visible'),
            makeCaseWithoutRecord(missingRecordCaseId, 'CN-MISSING-EXPLORER'),
          ]),
        ),
      }),
    );

    await page.goto('/cases');

    await expect(page.getByRole('link', { name: 'View', exact: true })).toBeVisible();
    await expect(page.getByText('Shared', { exact: true })).toHaveCount(0);
    const caseOptions = page.getByRole('button', { name: /Options for Visible/ });
    const caseRow = page.getByRole('listitem').filter({ has: caseOptions });
    await expect(caseRow).toBeVisible();
    await expect(caseRow.getByText('Plaintiff', { exact: true })).toBeVisible();
    await expect(caseRow.getByRole('link', { name: 'View' })).toHaveAttribute('href', `/cases/${visibleCaseId}`);
    await caseOptions.click();
    await expect(page.getByRole('menuitem')).toHaveText([
      'Share',
      'QA Bot',
      'Manage Documents',
      'View Arguments',
      'Prepare Argument',
      'Timeline Builder',
      'View Declarations',
      'Prepare Declaration',
      'Statistics',
    ]);
    await expect(page.getByRole('menuitem', { name: 'Statistics' })).toHaveAttribute(
      'href', `/cases/${visibleCaseId}/usage`,
    );
    await page.keyboard.press('Escape');

    await expect(
      page.locator(`a[href="/cases/${visibleCaseId}"]`).first(),
    ).toBeVisible();
    await expect(
      page.locator(`a[href="/cases/${missingRecordCaseId}"]`),
    ).toHaveCount(0);
    await expect(page.getByText('No case record available.')).toHaveCount(0);

    const caseDetailsLink = page.getByRole('link', { name: 'View', exact: true });
    await caseDetailsLink.click();
    await expect(page).toHaveURL('/cases/' + visibleCaseId);
  });

  test('Case Explorer limits guest actions to enabled case features', async ({ page }) => {
    const guestCaseId = '00000000-0000-4000-8000-000000001005';
    await page.route(casesApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeCasesResponse([{
          ...makeCaseWithRecord(guestCaseId, 'Guest'),
          isGuest: true,
          canUseQA: true,
          canAccessDocuments: true,
          canGenerateDeclaration: false,
        }])),
      }),
    );

    await page.goto('/cases');
    await expect(page.getByRole('link', { name: 'View', exact: true })).toBeVisible();
    await expect(page.getByText('Shared', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Options for Guest/ }).click();
    await expect(page.getByRole('menuitem')).toHaveText(['QA Bot', 'Manage Documents']);
  });

  test('Your Cases panel filters out entries without records', async ({
    page,
  }) => {
    const visibleCaseId = '00000000-0000-4000-8000-000000001002';
    const missingRecordCaseId = '00000000-0000-4000-8000-000000001003';

    await page.route(casesApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          makeCasesResponse([
            makeCaseWithRecord(visibleCaseId, 'HomeVisible'),
            makeCaseWithoutRecord(missingRecordCaseId, 'CN-MISSING-HOME'),
          ]),
        ),
      }),
    );

    await page.goto('/');

    await expect(page.getByText('Your Cases')).toBeVisible();
    await expect(
      page.locator(`a[href="/cases/${visibleCaseId}"]`).first(),
    ).toBeVisible();
    await expect(
      page.locator(`a[href="/cases/${missingRecordCaseId}"]`),
    ).toHaveCount(0);
  });
});
