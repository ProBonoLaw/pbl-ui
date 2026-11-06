import { expect, Page, test } from '@playwright/test';
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

const caseId = '00000000-0000-4000-8000-000000001014';
const argumentRequestId = '00000000-0000-4000-8000-000000001018';

function makeCaseDetailsResponse() {
  return {
    id: '00000000-0000-4000-8000-000000001015',
    emailAddresses: ['e2e.user@example.com'],
    oids: ['00000000-0000-4000-8000-000000001016'],
    casesAccounts: [
      {
        accountId: caseId,
        caseNumber: 'CN-E2E-REQUEST',
        agreedToCaseTerms: true,
        isGuest: false,
        canGenerateDeclaration: true,
        canUseQA: true,
        canAccessDocuments: true,
      },
    ],
    accountId: '00000000-0000-4000-8000-000000001017',
    agreedToTerms: true,
    isActive: true,
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function installCommonRoutes(page: Page) {
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

  await page.route(`**/api/accounts/cases/${caseId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeCaseDetailsResponse()),
    }),
  );
}

async function submitRequestAndCloseWithEnter({
  page,
  requestPath,
  submitApi,
  preparingTitle,
  modalTitle,
  redirectPath,
}: {
  page: Page;
  requestPath: string;
  submitApi: string;
  preparingTitle: string;
  modalTitle: string;
  redirectPath: string;
}) {
  const submitCanFinish = deferred();
  await page.route(submitApi, async (route) => {
    await submitCanFinish.promise;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: crypto.randomUUID() }),
    });
  });

  await page.goto(requestPath);
  await expect(page.getByRole('note', { name: 'AI output warning' })).toHaveText(
    'AI-generated. May be inaccurate. Verify before relying on outputs.',
  );
  await page.getByRole('textbox').fill('Prepare this request.');
  await page.getByRole('button', { name: 'Submit Request' }).click();

  await expect(page.getByRole('status')).toContainText(preparingTitle);
  await expect(page.getByRole('textbox')).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Preparing...' }),
  ).toBeDisabled();

  submitCanFinish.resolve();

  await expect(page.getByRole('heading', { name: modalTitle })).toBeVisible();
  await expect(page.getByRole('button', { name: 'OK' })).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${redirectPath}$`));
}

test.describe('request detail loading state', () => {
  test.beforeEach(async ({ page }) => {
    await installCommonRoutes(page);
  });

  test('argument viewer shows a spinner while loading the request', async ({
    page,
  }) => {
    const requestCanFinish = deferred();
    await page.route(
      `**/api/accounts/cases/${caseId}/requests/${argumentRequestId}`,
      async (route) => {
        await requestCanFinish.promise;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: argumentRequestId,
            accountId: caseId,
            sessionId: '00000000-0000-4000-8000-000000001019',
            input: 'Prepare an argument.',
            type: 'argument-builder',
            status: 'completed',
            output: null,
            oid: '00000000-0000-4000-8000-000000001016',
            startedAt: '2026-06-15T00:00:00.000Z',
            endedAt: '2026-06-15T00:01:00.000Z',
            contents: [],
            sourceUrl: null,
            rawOutputJson: null,
          }),
        });
      },
    );

    await page.goto(`/cases/${caseId}/argument-builder/${argumentRequestId}`);

    await expect(page.getByRole('status')).toContainText('Loading');

    requestCanFinish.resolve();

    await expect(
      page.getByRole('note', { name: 'AI output warning' }),
    ).toHaveText(
      'AI-generated. May be inaccurate. Verify before relying on outputs.',
    );
    await expect(
      page.getByText('No argument builder result is available yet.'),
    ).toBeVisible();
  });
});

test.describe('request submission modal focus', () => {
  test.beforeEach(async ({ page }) => {
    await installCommonRoutes(page);
  });

  test('argument submission modal closes with Enter', async ({ page }) => {
    await submitRequestAndCloseWithEnter({
      page,
      requestPath: `/cases/${caseId}/argument-builder/request`,
      submitApi: `**/api/accounts/cases/${caseId}/argument-builder/submit`,
      preparingTitle: 'Preparing Argument',
      modalTitle: 'Argument Submitted',
      redirectPath: `/cases/${caseId}/argument-builder`,
    });
  });

  test('declaration submission modal closes with Enter', async ({ page }) => {
    await submitRequestAndCloseWithEnter({
      page,
      requestPath: `/cases/${caseId}/declarations/request`,
      submitApi: `**/api/accounts/cases/${caseId}/declarations/submit`,
      preparingTitle: 'Preparing Declaration',
      modalTitle: 'Declaration Submitted',
      redirectPath: `/cases/${caseId}/declarations`,
    });
  });
});
