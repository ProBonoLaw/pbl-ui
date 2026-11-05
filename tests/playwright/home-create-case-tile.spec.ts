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
const termsApi = '**/api/accounts/terms**';

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

test.describe('Home Create Case tile', () => {
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

  test('navigates to the Create New Case page when enabled', async ({
    page,
  }) => {
    await page.route(casesApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeCasesResponse([])),
      }),
    );

    await page.goto('/');

    const yourCasesPanel = page
      .locator('div', {
        has: page.getByRole('heading', { name: 'Your Cases', exact: true }),
      })
      .first();
    const createCaseTile = yourCasesPanel
      .locator('article', { hasText: 'New Case' })
      .first();
    const createCaseLink = createCaseTile.locator('a[href="/cases/create"]');
    await expect(createCaseLink).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/cases\/create$/, { timeout: 10000 }),
      createCaseLink.click(),
    ]);

    await expect(
      page.getByRole('heading', { name: 'Create New Case', exact: true }),
    ).toBeVisible();
  });

  test("requires terms before showing the Create Case tile when user hasn't agreed", async ({
    page,
  }) => {
    await page.unroute(userAccessApi);
    await page.route(userAccessApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ agreedToTerms: false, isActive: true }),
      }),
    );
    await page.route(termsApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          title: 'Terms of Service',
          effectiveDate: 'December 1, 2025',
          markdown: 'These are the user account terms.',
          acknowledgement:
            'I have read and agree to the Pro Bono Law Terms of Service.',
        }),
      }),
    );
    await page.route(casesApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeCasesResponse([])),
      }),
    );

    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'Terms of Service' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Your Cases', exact: true }),
    ).toHaveCount(0);
    await expect(page.locator('a[href="/cases/create"]')).toHaveCount(0);
  });

  test('is disabled with warning when user account is inactive', async ({
    page,
  }) => {
    await page.unroute(userAccessApi);
    await page.route(userAccessApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ agreedToTerms: true, isActive: false }),
      }),
    );
    await page.route(casesApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeCasesResponse([])),
      }),
    );

    await page.goto('/');

    const yourCasesPanel = page
      .locator('div', {
        has: page.getByRole('heading', { name: 'Your Cases', exact: true }),
      })
      .first();
    const createCaseTile = yourCasesPanel
      .locator('article', { hasText: 'New Case' })
      .first();

    await expect(createCaseTile.locator('a[href="/cases/create"]')).toHaveCount(
      0,
    );
    await expect(
      createCaseTile.getByText(
        /Create Case is unavailable because your account .*inactive\./i,
      ),
    ).toBeVisible();
  });
});
