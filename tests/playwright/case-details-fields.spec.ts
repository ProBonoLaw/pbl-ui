import { expect, test, type Page } from '@playwright/test';
import { installMockAuthRuntimeDependencies } from './fixtures/auth';

const notificationsCountApi = '**/api/accounts/notifications/count**';
const negotiateApi = '**/api/realtime/negotiate';
const userAccessApi = '**/api/accounts/access**';
const initializeAccountApi = '**/api/accounts/initialize**';
const enableAccountsApi = '**/api/accounts/cases/enable**';

const CASE_ID = '00000000-0000-4000-8000-000000001008';
const ACCOUNT_ID = '00000000-0000-4000-8000-000000001012';
const OWNER_OID = '00000000-0000-4000-8000-000000001013';

async function installCommonRoutes(
  page: Page,
  options: {
    isGuest?: boolean;
    isActive?: boolean;
    inactiveAccountForbidden?: boolean;
  } = {},
) {
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

  let caseDetailsRequestCount = 0;
  await page.route('**/api/accounts/cases/' + CASE_ID, (route) => {
    caseDetailsRequestCount += 1;
    if (options.inactiveAccountForbidden === true) {
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Your account is inactive.',
          code: 'ACCOUNT_INACTIVE',
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: CASE_ID,
        accountId: ACCOUNT_ID,
        emailAddresses: ['e2e.user@example.com'],
        oids: [OWNER_OID],
        agreedToTerms: true,
        isActive: true,
        casesAccounts: [
          {
            accountId: ACCOUNT_ID,
            caseNumber: 'VIEW-123',
            agreedToCaseTerms: true,
            isGuest: options.isGuest ?? false,
            isActive: options.isActive ?? true,
            canUseQA: true,
            canGenerateDeclaration: true,
            canAccessDocuments: true,
            record: {
              id: CASE_ID,
              accountId: ACCOUNT_ID,
              type: 'ACCOUNT_DETAILS',
              caseNumber: 'VIEW-123',
              filingRole: 'Plaintiff',
              state: 'WA',
              county: 'King',
              description: 'View page field parity test',
              personInformation: {
                firstName: 'Pat',
                lastName: 'Client',
                organization: 'Client Org',
                emailAddress: 'client@example.com',
                phoneNumber: '111-111-1111',
              },
              currentAttorney: {
                firstName: 'Alex',
                lastName: 'Attorney',
                firmName: 'Counsel Firm',
                emailAddress: 'attorney@example.com',
                phoneNumber: '222-222-2222',
                isCurrent: true,
              },
              opposition: {
                firstName: 'Opp',
                lastName: 'Party',
                organization: 'Opp Org',
                filingRole: 'Defendant',
                emailAddress: 'opp@example.com',
                phoneNumber: '333-333-3333',
                currentAttorney: {
                  firstName: 'Taylor',
                  lastName: 'OppCounsel',
                  firmName: 'Opp Firm',
                  emailAddress: 'opp.attorney@example.com',
                  phoneNumber: '444-444-4444',
                  isCurrent: true,
                },
              },
            },
          },
        ],
      }),
    });
  });

  return {
    getCaseDetailsRequestCount: () => caseDetailsRequestCount,
  };
}

test('case details shows all case fields and offers editing to the owner', async ({
  page,
}) => {
  const routes = await installCommonRoutes(page);

  await page.goto('/cases/' + CASE_ID);

  await expect(page.getByRole('button', { name: 'Unshare Case' })).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Case' })).toBeVisible();
  await expect(
    page.locator('nav[aria-label="Case navigation"]').getByRole('link', { name: 'Details' }),
  ).toBeVisible();
  await expect(
    page.locator('nav[aria-label="Case navigation"]').getByRole('link', { name: 'Edit' }),
  ).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Case Information', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Person Information', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Current Attorney', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Opposition Information', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: "Opposition's Attorney", exact: true })).toBeVisible();

  await expect(page.getByText('Client Org')).toBeVisible();
  await expect(page.getByText('client@example.com')).toBeVisible();
  await expect(page.getByText('111-111-1111')).toBeVisible();

  await expect(page.getByText('Counsel Firm')).toBeVisible();
  await expect(
    page.getByText('attorney@example.com', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('222-222-2222')).toBeVisible();

  await expect(page.getByText('Opp Org')).toBeVisible();
  await expect(page.getByText('opp@example.com')).toBeVisible();
  await expect(page.getByText('333-333-3333')).toBeVisible();

  await expect(page.getByText('Opp Firm')).toBeVisible();
  await expect(
    page.getByText('opp.attorney@example.com', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('444-444-4444')).toBeVisible();
  await expect.poll(() => routes.getCaseDetailsRequestCount()).toBe(1);
});

test('case deletion requires confirmation and Cancel preserves the case', async ({
  page,
}) => {
  await installCommonRoutes(page);
  let deleteRequests = 0;
  await page.route('**/api/accounts/cases/' + CASE_ID, async (route) => {
    if (route.request().method() !== 'DELETE') {
      await route.fallback();
      return;
    }
    deleteRequests += 1;
    await route.fulfill({ status: 204, body: '' });
  });
  await page.route('**/api/accounts/cases', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );

  await page.goto('/cases/' + CASE_ID);
  const deleteAction = page.locator('[data-slot="case-page-actions"]').getByRole('button', { name: 'Delete' });
  await expect(deleteAction).toBeVisible();
  await deleteAction.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Delete' })).toBeVisible();
  await expect(dialog).toContainText('This action cannot be undone.');
  expect(deleteRequests).toBe(0);

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  expect(deleteRequests).toBe(0);
  await expect(page).toHaveURL(new RegExp('/cases/' + CASE_ID + '$'));

  await deleteAction.click();
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect.poll(() => deleteRequests).toBe(1);
  await expect(page).toHaveURL(/\/cases$/);
});

test('case view aligns its sections with the edit form on desktop and mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await installCommonRoutes(page);
  await page.goto('/cases/' + CASE_ID);

  const section = page.locator('#case-details');
  await expect(section.getByRole('heading', { name: 'Case Information' })).toBeVisible();
  const pageHeading = page.getByRole('heading', { name: 'Case Details', exact: true });
  const desktopHeadingLeft = await pageHeading.evaluate((element) =>
    element.getBoundingClientRect().left + parseFloat(getComputedStyle(element).paddingLeft),
  );
  const desktopSection = await section.boundingBox();
  expect(desktopSection).not.toBeNull();
  expect(Math.abs(desktopHeadingLeft - desktopSection!.x)).toBeLessThan(2);
  const viewHeading = await section.locator(':scope > div').first().boundingBox();
  const viewFields = await section.locator(':scope > div').nth(1).boundingBox();
  if (!viewHeading || !viewFields) {
    throw new Error('Expected case view section columns to be visible');
  }
  expect(viewFields.x).toBeGreaterThan(viewHeading.x + viewHeading.width);

  await page.getByRole('button', { name: 'Edit Case' }).click();
  const editFields = await section.locator(':scope > div').nth(1).boundingBox();
  if (!editFields) {
    throw new Error('Expected case edit section fields to be visible');
  }
  expect(Math.abs(editFields.x - viewFields.x)).toBeLessThan(2);
  expect(Math.abs(editFields.width - viewFields.width)).toBeLessThan(2);

  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileHeadingLeft = await pageHeading.evaluate((element) =>
    element.getBoundingClientRect().left + parseFloat(getComputedStyle(element).paddingLeft),
  );
  const mobileSection = await section.boundingBox();
  expect(mobileSection).not.toBeNull();
  expect(Math.abs(mobileHeadingLeft - mobileSection!.x)).toBeLessThan(2);
  const mobileHeading = await section.locator(':scope > div').first().boundingBox();
  const mobileFields = await section.locator(':scope > div').nth(1).boundingBox();
  if (!mobileHeading || !mobileFields) {
    throw new Error('Expected mobile case view section to be visible');
  }
  expect(mobileFields.y).toBeGreaterThan(mobileHeading.y + mobileHeading.height);
});

test('case content scrolls without moving the page header', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await installCommonRoutes(page);
  await page.goto('/cases/' + CASE_ID);

  const heading = page.getByRole('heading', { name: 'Case Details', exact: true });
  await expect(heading).toBeVisible();
  const content = page.locator('[data-slot="page-content"]');
  const headerTop = (await heading.boundingBox())?.y;
  expect(headerTop).toBeDefined();
  expect(await content.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);

  await content.evaluate((element) => element.scrollTo(0, element.scrollHeight));

  expect(await content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(700);
  expect((await heading.boundingBox())?.y).toBe(headerTop);

  await page.setViewportSize({ width: 390, height: 700 });
  await content.evaluate((element) => element.scrollTo(0, 0));
  const mobileHeaderTop = (await heading.boundingBox())?.y;
  await content.evaluate((element) => element.scrollTo(0, element.scrollHeight));
  expect(await content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(700);
  expect((await heading.boundingBox())?.y).toBe(mobileHeaderTop);
});

test('case details edits and saves on the same route, and Cancel discards changes', async ({
  page,
}) => {
  await installCommonRoutes(page);
  await page.route('**/api/jurisdictions', (route) =>
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

  let savedState: string | null = null;
  let savedFilingRole: string | null = null;
  let savedOppositionRole: string | null = null;
  let saveAttempts = 0;
  await page.route('**/api/accounts/cases/' + CASE_ID, async (route) => {
    if (route.request().method() === 'PUT') {
      saveAttempts += 1;
      const payload = route.request().postDataJSON() as {
        record?: { state?: string; filingRole?: string; opposition?: { filingRole?: string } };
      };
      savedState = payload.record?.state ?? null;
      savedFilingRole = payload.record?.filingRole ?? null;
      savedOppositionRole = payload.record?.opposition?.filingRole ?? null;
      if (saveAttempts === 1) {
        return route.fulfill({ status: 500, body: 'Save failed' });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: CASE_ID,
          accountId: ACCOUNT_ID,
          emailAddresses: ['e2e.user@example.com'],
          oids: [OWNER_OID],
          agreedToTerms: true,
          isActive: true,
          casesAccounts: [payload],
        }),
      });
    }
    await route.fallback();
  });

  await page.goto('/cases/' + CASE_ID);
  await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'State', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit Case' }).click();
  await expect(page).toHaveURL(new RegExp('/cases/' + CASE_ID + '$'));
  await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
  const actions = page.locator('[data-slot="case-page-actions"]');
  for (const name of ['Cancel', 'Reset', 'Save Changes']) {
    await expect(actions.getByRole('button', { name })).toBeVisible();
  }
  await expect(page.locator('form').getByRole('button', { name: 'Save Changes' })).toHaveCount(0);

  await page.getByRole('textbox', { name: 'Description' }).fill('Unsaved change');
  await actions.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByRole('textbox', { name: 'Description' })).toHaveValue('View page field parity test');
  await page.getByRole('textbox', { name: 'Description' }).fill('Unsaved change');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('View page field parity test')).toBeVisible();
  expect(savedState).toBeNull();

  await page.getByRole('button', { name: 'Edit Case' }).click();

  const state = page.getByRole('combobox', { name: 'State', exact: true });
  await expect(state).toHaveValue('Washington from table');
  await state.fill('OK');
  await page.getByRole('option', { name: 'Oklahoma from table' }).click();
  await expect(page.locator('input[name="state"]')).toHaveValue('OK');

  const filingRole = page.getByRole('combobox', { name: 'Case Filing Role' });
  await filingRole.fill('Petitioner');
  await page.getByRole('option', { name: 'Petitioner' }).click();
  await expect(page.getByRole('combobox', { name: 'Opposition Filing Role' })).toHaveValue('Respondent');

  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Failed to update case' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect.poll(() => savedState).toBe('OK');
  await expect.poll(() => savedFilingRole).toBe('Petitioner');
  await expect.poll(() => savedOppositionRole).toBe('Respondent');
  await expect.poll(() => saveAttempts).toBe(2);
  await expect(page.getByRole('status')).toHaveText('Case changes saved.');
  await expect(page.getByText('OK', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp('/cases/' + CASE_ID + '$'));
});

test('the old edit URL opens the read-only case details first', async ({ page }) => {
  await installCommonRoutes(page);
  await page.goto('/cases/' + CASE_ID + '/edit');

  await expect(page).toHaveURL(new RegExp('/cases/' + CASE_ID + '$'));
  await expect(page.getByText('View page field parity test')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'State', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit Case' }).click();
  await expect(page.getByRole('combobox', { name: 'State', exact: true })).toBeVisible();
});

test('view case page shows inactive account modal for non-guest access', async ({
  page,
}) => {
  await installCommonRoutes(page, { inactiveAccountForbidden: true });

  await page.goto('/cases/' + CASE_ID);

  await expect(
    page.getByRole('heading', { name: 'Account inactive' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Your account is not active and does not have access to Case pages.',
    ),
  ).toBeVisible();
  await expect(
    page.getByText('To enable your account, contact your service administrator.'),
  ).toBeVisible();
});

test('view case page lets guest unshare shared case', async ({ page }) => {
  await installCommonRoutes(page, { isGuest: true });

  let unshareCalled = false;
  await page.route(
    '**/api/accounts/cases/' + CASE_ID + '/users/me',
    async (route) => {
      expect(route.request().method()).toBe('DELETE');
      unshareCalled = true;
      await route.fulfill({ status: 204, body: '' });
    },
  );
  await page.route('**/api/accounts/cases', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );

  await page.goto('/cases/' + CASE_ID);

  await expect(page.getByRole('button', { name: 'Edit Case' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Unshare Case' }).click();
  await page.getByRole('button', { name: 'Unshare' }).click();

  await expect.poll(() => unshareCalled).toBe(true);
});
