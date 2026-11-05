import { test, expect, type Page } from '@playwright/test';
import { installMockAuthRuntimeDependencies } from './fixtures/auth';

const casesApi = '**/api/accounts/cases';
const jurisdictionsApi = '**/api/jurisdictions';
const notificationsCountApi = '**/api/accounts/notifications/count**';
const negotiateApi = '**/api/realtime/negotiate';
const userAccessApi = '**/api/accounts/access**';
const initializeAccountApi = '**/api/accounts/initialize**';
const enableAccountsApi = '**/api/accounts/cases/enable**';
const graphMeApi = 'https://graph.microsoft.com/beta/me';
const graphPhotoApi = 'https://graph.microsoft.com/beta/me/photo/$value';

async function selectBillingCode(page: Page, label: string, code: string) {
  const billingCode = page.getByRole('combobox', { name: 'Billing Code' });
  await billingCode.click();
  await billingCode.fill(label);
  await page.getByRole('option', { name: label, exact: true }).click();
  await expect(page.locator('input[name="billingCode"]')).toHaveValue(code);
}

function makeGraphProfile(overrides?: Record<string, unknown>) {
  return {
    id: '00000000-0000-4000-8000-000000001091',
    accountEnabled: true,
    createdDateTime: '2026-01-01T00:00:00.000Z',
    displayName: 'Create Case User',
    givenName: 'Create',
    surname: 'User',
    isLicenseReconciliationNeeded: false,
    mail: 'create.case.user@example.com',
    mailNickname: 'createcaseuser',
    refreshTokensValidFromDateTime: '2026-01-01T00:00:00.000Z',
    securityIdentifier: 'S-1-5-21-1234567890-123456789-123456789-5678',
    signInSessionsValidFromDateTime: '2026-01-01T00:00:00.000Z',
    userType: 'Member',
    userPrincipalName: 'create.case.user@example.com',
    mobilePhone: '+1-555-0101',
    streetAddress: '123 Main St',
    city: 'Chicago',
    state: 'IL',
    postalCode: '60601',
    country: 'USA',
    extension_example_IsAttorney: false,
    isAttorney: false,
    ...overrides,
  };
}

test.describe('Create case page', () => {
  test.beforeEach(async ({ page }) => {
    await installMockAuthRuntimeDependencies(page);

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
    await page.route(graphMeApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeGraphProfile()),
      }),
    );
    await page.route(graphPhotoApi, (route) =>
      route.fulfill({
        status: 404,
        body: '',
      }),
    );
    await page.route(jurisdictionsApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          states: [
            { jurisdictionCode: 'OK', countryCode: 'US', name: 'Oklahoma from table', type: 'State' },
            { jurisdictionCode: 'WA', countryCode: 'US', name: 'Washington from table', type: 'State' },
          ],
          federal: [],
          tribal: [],
        }),
      }),
    );
  });

  test('auto-syncs filing roles between case and opposition in both directions', async ({
    page,
  }) => {
    await page.goto('/cases/create');

    const state = page.getByRole('combobox', { name: 'State', exact: true });
    await expect(state).toHaveValue('Oklahoma from table');
    await state.click();
    await state.fill('WA');
    await page.getByRole('option', { name: 'Washington from table' }).click();
    await expect(state).toHaveValue('Washington from table');
    await expect(page.locator('input[name="state"]')).toHaveValue('WA');

    const filingRole = page.getByRole('combobox', { name: 'Case Filing Role' });
    const oppositionRole = page.getByRole('combobox', { name: 'Opposition Filing Role' });

    await filingRole.click();
    await filingRole.fill('Plaintiff');
    await page.getByRole('option', { name: 'Plaintiff' }).click();
    await expect(oppositionRole).toHaveValue('Defendant');
    await expect(page.locator('input[name="oppositionFilingRole"]')).toHaveValue('Defendant');

    await filingRole.click();
    await filingRole.fill('Petitioner');
    await page.getByRole('option', { name: 'Petitioner' }).click();
    await expect(oppositionRole).toHaveValue('Respondent');

    await oppositionRole.click();
    await oppositionRole.fill('Plaintiff');
    await page.getByRole('option', { name: 'Plaintiff' }).click();
    await expect(filingRole).toHaveValue('Defendant');

    await oppositionRole.click();
    await oppositionRole.fill('Petitioner');
    await page.getByRole('option', { name: 'Petitioner' }).click();
    await expect(filingRole).toHaveValue('Respondent');
    await expect(page.locator('input[name="filingRole"]')).toHaveValue('Respondent');
    await selectBillingCode(page, 'Silver', 'S1');

    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(filingRole).toHaveValue('');
    await expect(oppositionRole).toHaveValue('');
    await expect(state).toHaveValue('Oklahoma from table');
    await expect(page.getByRole('combobox', { name: 'Billing Code' })).toHaveValue('');
    await expect(page.locator('input[name="state"]')).toHaveValue('OK');
    await expect(page.locator('input[name="billingCode"]')).toHaveValue('');
  });

  test('requires a billing code before submitting a new case', async ({ page }) => {
    await page.goto('/cases/create');
    await page.fill('input[name="caseNumber"]', 'E2E-NO-BILLING');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByRole('heading', { name: 'Validation Error' })).toBeVisible();
    await expect(page.getByText('Select a billing code.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Confirm Case Ownership' })).toHaveCount(0);
  });

  test('shows repository-ready modal after submit and navigates to Case Explorer on OK', async ({
    page,
  }) => {
    let postCount = 0;
    await page.route(casesApi, async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        postCount += 1;
        await route.fulfill({ status: 204, body: '' });
        return;
      }
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/cases/create');

    await page.fill('input[name="caseNumber"]', 'E2E-CN-100');
    await selectBillingCode(page, 'Silver', 'S1');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(
      page.getByRole('heading', { name: 'Confirm Case Ownership' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Proceed' }).click();

    await expect.poll(() => postCount).toBe(1);
    await expect(
      page.getByRole('heading', { name: 'Case Submitted' }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Your case was submitted. Your case repository will be ready in a few minutes.',
      ),
    ).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/cases$/, { timeout: 10000 }),
      page.getByRole('button', { name: 'OK' }).click(),
    ]);
  });

  test('shows validation modal and does not submit on schema validation failure', async ({
    page,
  }) => {
    let postCount = 0;
    await page.route(casesApi, async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        postCount += 1;
        await route.fulfill({ status: 204, body: '' });
        return;
      }
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/cases/create');

    await page.fill('input[name="caseNumber"]', 'E2E-CN-101');
    await selectBillingCode(page, 'Silver', 'S1');
    await page.evaluate(() => {
      const stateInput = document.querySelector(
        'input[name="state"]',
      ) as HTMLInputElement | null;
      if (stateInput) {
        stateInput.value = 'ok';
      }
    });

    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(
      page.getByRole('heading', { name: 'Validation Error' }),
    ).toBeVisible();
    await expect(page.getByText('Expected 2-letter state code')).toBeVisible();

    await expect(
      page.getByRole('heading', { name: 'Confirm Case Ownership' }),
    ).not.toBeVisible();
    await expect.poll(() => postCount).toBe(0);
  });

  test('submits G1 billing code for Gold cases', async ({ page }) => {
    let capturedBody: Record<string, unknown> | null = null;
    await page.route(casesApi, async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        capturedBody = route.request().postDataJSON() as Record<
          string,
          unknown
        >;
        await route.fulfill({ status: 204, body: '' });
        return;
      }
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/cases/create');
    await page.fill('input[name="caseNumber"]', 'E2E-CN-GOLD-1');
    await selectBillingCode(page, 'Gold', 'G1');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(
      page.getByRole('heading', { name: 'Confirm Case Ownership' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Proceed' }).click();

    await expect.poll(() => capturedBody?.billingCode).toBe('G1');
  });

  test('submits D billing code for Demo cases', async ({ page }) => {
    let capturedBody: Record<string, unknown> | null = null;
    await page.route(casesApi, async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        capturedBody = route.request().postDataJSON() as Record<
          string,
          unknown
        >;
        await route.fulfill({ status: 204, body: '' });
        return;
      }
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/cases/create');
    await page.fill('input[name="caseNumber"]', 'E2E-CN-DEMO-1');
    await selectBillingCode(page, 'Demo', 'D');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(
      page.getByRole('heading', { name: 'Confirm Case Ownership' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Proceed' }).click();

    await expect.poll(() => capturedBody?.billingCode).toBe('D');
  });

  test('submits F billing code for Probono cases when user is attorney', async ({
    page,
  }) => {
    await page.unroute(graphMeApi);
    await page.route(graphMeApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          makeGraphProfile({
            displayName: 'E2E Attorney',
            extension_example_IsAttorney: true,
            isAttorney: true,
          }),
        ),
      }),
    );

    let capturedBody: Record<string, unknown> | null = null;
    await page.route(casesApi, async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        capturedBody = route.request().postDataJSON() as Record<
          string,
          unknown
        >;
        await route.fulfill({ status: 204, body: '' });
        return;
      }
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/cases/create');
    await page.fill('input[name="caseNumber"]', 'E2E-CN-PROBONO-1');
    await selectBillingCode(page, 'ProBono Cases', 'F');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(
      page.getByRole('heading', { name: 'Confirm Case Ownership' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Proceed' }).click();

    await expect.poll(() => capturedBody?.billingCode).toBe('F');
  });

  test('shows request-failed modal when case creation request cannot be fulfilled', async ({
    page,
  }) => {
    await page.route(casesApi, async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
        return;
      }
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/cases/create');
    await page.fill('input[name="caseNumber"]', 'E2E-CN-500-ERR');
    await selectBillingCode(page, 'Silver', 'S1');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(
      page.getByRole('heading', { name: 'Confirm Case Ownership' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Proceed' }).click();

    await expect(
      page.getByRole('heading', { name: 'Request Failed' }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Your request couldn't be fulfilled at this time. Please try again later.",
      ),
    ).toBeVisible();
  });
});
