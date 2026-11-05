import { expect, type Page, test } from '@playwright/test';
import { installMockAuthRuntimeDependencies } from './fixtures/auth';

const CASE_ID = '00000000-0000-4000-8000-000000001000';
const ACCOUNT_ID = '00000000-0000-4000-8000-000000001001';
const SECOND_CASE_ID = '00000000-0000-4000-8000-000000001004';
const SECOND_ACCOUNT_ID = '00000000-0000-4000-8000-000000001008';

function makeCaseAccount({
  id,
  accountId,
  caseNumber,
  nickname,
}: {
  id: string;
  accountId: string;
  caseNumber: string;
  nickname: string;
}) {
  return {
    accountId,
    caseNumber,
    agreedToCaseTerms: true,
    isGuest: false,
    canUseQA: true,
    canGenerateDeclaration: true,
    canAccessDocuments: true,
    record: {
      id,
      accountId,
      type: 'ACCOUNT_DETAILS',
      caseNumber,
      filingRole: 'Plaintiff',
      state: 'WA',
      county: 'King',
      description: 'E2E case',
      nickname,
      personInformation: {
        firstName: 'Case',
        lastName: 'Owner',
        emailAddress: '',
        phoneNumber: '',
      },
      opposition: {
        firstName: 'Other',
        lastName: 'Party',
        filingRole: 'Defendant',
        emailAddress: '',
        phoneNumber: '',
      },
    },
  };
}

function makeCaseResponse(caseAccount: ReturnType<typeof makeCaseAccount>) {
  return {
    id: CASE_ID,
    accountId: CASE_ID,
    emailAddresses: ['e2e.user@example.com'],
    oids: ['00000000-0000-4000-8000-000000001012'],
    agreedToTerms: true,
    isActive: true,
    casesAccounts: [caseAccount],
  };
}

async function installRoutes(page: Page) {
  const firstCase = makeCaseAccount({
    id: CASE_ID,
    accountId: ACCOUNT_ID,
    caseNumber: 'CASE-100',
    nickname: 'Project Sunrise',
  });
  const secondCase = makeCaseAccount({
    id: SECOND_CASE_ID,
    accountId: SECOND_ACCOUNT_ID,
    caseNumber: 'CASE-200',
    nickname: 'Project Harbor',
  });

  await installMockAuthRuntimeDependencies(page);
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
  await page.route('**/api/accounts/cases', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        makeCaseResponse(firstCase),
        makeCaseResponse(secondCase),
      ]),
    }),
  );
  await page.route('**/api/accounts/cases/' + ACCOUNT_ID, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeCaseResponse(firstCase)),
    }),
  );
}

test('desktop case menu lists account cases and opens the selected case', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await installRoutes(page);

  await page.goto('/cases');
  await page.getByRole('button', { name: 'Cases' }).click();

  await expect(page.getByRole('heading', { name: 'Your cases' })).toBeVisible();
  const firstCaseLink = page.getByRole('link', {
    name: 'CASE-100 Project Sunrise',
    exact: true,
  });
  await expect(firstCaseLink).toBeVisible();
  await expect(
    page.getByRole('link', {
      name: 'CASE-200 Project Harbor',
      exact: true,
    }),
  ).toBeVisible();

  await Promise.all([
    page.waitForURL(new RegExp('/cases/' + ACCOUNT_ID + '$')),
    firstCaseLink.click(),
  ]);
});

test('desktop side navigation shows the case title and number on separate lines', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1200 });
  await installRoutes(page);

  await page.goto('/cases/' + ACCOUNT_ID);

  const navigation = page.locator('nav[aria-label="Case navigation"]');
  await expect(
    navigation.getByText('Project Sunrise', { exact: true }),
  ).toBeVisible();
  await expect(navigation.getByText('CASE-100', { exact: true })).toBeVisible();
  await expect(
    navigation.getByText('Project Sunrise (CASE-100)', { exact: true }),
  ).toHaveCount(0);

  const navigationBounds = await navigation.boundingBox();
  const contentStart = await page
    .locator('div[class~="min-w-0"][class~="sm:pl-72"]')
    .evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const paddingLeft = Number.parseFloat(
        globalThis.getComputedStyle(element).paddingLeft,
      );
      return bounds.x + paddingLeft;
    });
  if (!navigationBounds) {
    throw new Error('Expected case navigation to be visible');
  }

  expect(navigationBounds.x + navigationBounds.width).toBeLessThanOrEqual(
    contentStart,
  );
});

test('desktop side navigation keeps a left gutter at the wide breakpoint', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1536, height: 900 });
  await installRoutes(page);

  await page.goto('/cases/' + ACCOUNT_ID);

  const navigation = page.locator('nav[aria-label="Case navigation"]');
  await expect(navigation).toBeVisible();
  const navigationBounds = await navigation.boundingBox();
  if (!navigationBounds) {
    throw new Error('Expected case navigation to be visible');
  }

  expect(navigationBounds.x).toBeGreaterThanOrEqual(32);
});

test('side navigation stays mounted while editing case details', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await installRoutes(page);

  await page.goto('/cases/' + ACCOUNT_ID);

  const navigation = page.locator('nav[aria-label="Case navigation"]');
  await expect(navigation.getByRole('link', { name: 'Details' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Edit' })).toHaveCount(0);
  const navigationHandle = await navigation.elementHandle();
  if (!navigationHandle) {
    throw new Error('Expected case navigation to be mounted');
  }

  await page.getByRole('button', { name: 'Edit Case' }).click();

  await expect(navigation).toBeVisible();
  await expect(page).toHaveURL(new RegExp('/cases/' + ACCOUNT_ID + '$'));
  await expect(page.getByRole('textbox', { name: 'Description' })).toBeVisible();
  const persisted = await navigationHandle.evaluate(
    (element) =>
      element.isConnected &&
      element === document.querySelector('nav[aria-label="Case navigation"]'),
  );
  expect(persisted).toBe(true);
});
test('mobile case menu retains the Case Management disclosure', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installRoutes(page);

  await page.goto('/cases/' + ACCOUNT_ID);
  await page.getByRole('button', { name: 'Open main menu' }).click();

  await expect(
    page.getByRole('button', { name: /Case Management/ }),
  ).toBeVisible();
});
