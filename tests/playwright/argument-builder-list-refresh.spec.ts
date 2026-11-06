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

const caseId = '00000000-0000-4000-8000-000000001020';
const requestId = '00000000-0000-4000-8000-000000001021';
const nowIso = '2026-01-01T00:00:00.000Z';

function makeCaseDetailsResponse({
  isGuest = false,
  canGenerateDeclaration = true,
}: {
  isGuest?: boolean;
  canGenerateDeclaration?: boolean;
} = {}) {
  return {
    id: '00000000-0000-4000-8000-000000001022',
    emailAddresses: ['e2e.user@example.com'],
    oids: ['00000000-0000-4000-8000-000000001023'],
    casesAccounts: [
      {
        accountId: caseId,
        caseNumber: 'CN-E2E-ARGUMENTS',
        agreedToCaseTerms: true,
        isGuest,
        canGenerateDeclaration,
        canUseQA: true,
        canAccessDocuments: true,
      },
    ],
    accountId: '00000000-0000-4000-8000-000000001024',
    agreedToTerms: true,
    isActive: true,
  };
}

function makeArgumentBuilderRequest() {
  return {
    id: requestId,
    accountId: caseId,
    sessionId: '00000000-0000-4000-8000-000000001025',
    input: 'Prepare a refreshed argument.',
    type: 'argument-builder',
    status: 'completed',
    output: null,
    oid: '00000000-0000-4000-8000-000000001026',
    startedAt: nowIso,
    endedAt: nowIso,
    contents: [],
    sourceUrl: null,
  };
}

async function installCommonRoutes(
  page: Page,
  caseAccess: {
    isGuest?: boolean;
    canGenerateDeclaration?: boolean;
  } = {},
) {
  await installMockAuthRuntimeDependencies(page);

  await page.route(graphMeApi, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeMockGraphProfile()),
    }),
  );

  await page.route(graphPhotoApi, (route) =>
    route.fulfill({ status: 404, body: '' }),
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
    route.fulfill({ status: 204, body: '' }),
  );

  await page.route(`**/api/accounts/cases/${caseId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeCaseDetailsResponse(caseAccess)),
    }),
  );
}

function waitForCaseDetailsResponse(page: Page) {
  return page.waitForResponse((response) => {
    let pathname: string;
    try {
      pathname = new URL(response.url()).pathname;
    } catch {
      return false;
    }

    return (
      response.request().method() === 'GET' &&
      response.status() === 200 &&
      pathname === '/api/accounts/cases/' + caseId
    );
  });
}

test('argument builder list refreshes after argument builder notification', async ({
  page,
}) => {
  await installCommonRoutes(page);

  let requests = [] as ReturnType<typeof makeArgumentBuilderRequest>[];
  let fetchCount = 0;

  await page.route(
    `**/api/accounts/cases/${caseId}/requests?requestType=argument-builder`,
    (route) => {
      fetchCount += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(requests),
      });
    },
  );

  await page.goto(`/cases/${caseId}/argument-builder`);

  await expect(page.getByRole('heading', { name: 'Arguments' })).toBeVisible();
  await expect(page.getByText('Prepare a refreshed argument.')).toHaveCount(0);
  await expect.poll(() => fetchCount).toBe(1);

  requests = [makeArgumentBuilderRequest()];
  await page.evaluate(
    ({ accountId }) => {
      window.dispatchEvent(
        new CustomEvent('notify:new', {
          detail: {
            id: 'notice-argument-builder-refresh',
            notificationType: 'ARGUMENT_BUILDER',
            createdAt: new Date(),
            oid: 'e2e-user-oid',
            accountId,
            status: 'SUCCESS',
          },
        }),
      );
    },
    { accountId: caseId },
  );

  await expect.poll(() => fetchCount).toBe(2);
  await expect(page.getByText('Prepare a refreshed argument.')).toBeVisible();
  await expect(
    page.locator(`a[href="/cases/${caseId}/argument-builder/${requestId}"]`),
  ).toBeVisible();
});

test('Refresh loads newly returned arguments', async ({ page }) => {
  await installCommonRoutes(page);
  let requests = [makeArgumentBuilderRequest()];
  let fetchCount = 0;
  let releaseRefresh!: () => void;
  const refreshGate = new Promise<void>((resolve) => { releaseRefresh = resolve; });
  await page.route(
    `**/api/accounts/cases/${caseId}/requests?requestType=argument-builder`,
    async (route) => {
      fetchCount += 1;
      if (fetchCount === 2) await refreshGate;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(requests) });
    },
  );

  await page.goto(`/cases/${caseId}/argument-builder`);
  await expect(page.getByText('Prepare a refreshed argument.')).toBeVisible();
  requests = [{ ...makeArgumentBuilderRequest(), input: 'Newly returned argument.' }];
  await page.locator('[data-slot="case-page-actions"]').getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByRole('button', { name: 'Refreshing…' })).toBeDisabled();
  releaseRefresh();
  await expect.poll(() => fetchCount).toBe(2);
  await expect(page.getByText('Newly returned argument.')).toBeVisible();
  await expect(page.getByText('Prepare a refreshed argument.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
});

test('argument list filters by request text and status', async ({ page }) => {
  await installCommonRoutes(page);
  const completed = makeArgumentBuilderRequest();
  const failed = {
    ...makeArgumentBuilderRequest(),
    id: '00000000-0000-4000-8000-000000001027',
    input: 'Analyze tenant appeal.',
    status: 'failed',
  };
  const started = {
    ...makeArgumentBuilderRequest(),
    id: '00000000-0000-4000-8000-000000001028',
    input: 'Draft tenant notice.',
    status: 'started',
  };
  await page.route(
    `**/api/accounts/cases/${caseId}/requests?requestType=argument-builder`,
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([completed, failed, started]) }),
  );

  await page.goto(`/cases/${caseId}/argument-builder`);
  const filters = page.locator('[data-slot="case-page-actions"]').getByRole('search', { name: 'arguments filters' });
  await expect(filters.getByText('Search', { exact: true })).toHaveCount(0);
  await expect(filters.getByText('Status', { exact: true })).toHaveCount(0);
  await filters.getByRole('searchbox', { name: 'Search arguments' }).fill('tenant');
  await expect(page.getByText('Prepare a refreshed argument.')).toHaveCount(0);
  await expect(page.getByText('Analyze tenant appeal.')).toBeVisible();
  await expect(page.getByText('Draft tenant notice.')).toBeVisible();

  await filters.getByRole('combobox', { name: 'Status' }).selectOption('failed');
  await expect(page.getByText('Analyze tenant appeal.')).toBeVisible();
  await expect(page.getByText('Draft tenant notice.')).toHaveCount(0);

  await filters.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByText('Prepare a refreshed argument.')).toBeVisible();
  await expect(page.getByText('Draft tenant notice.')).toBeVisible();
});

test('overdue argument can be resubmitted and deleted without a View link', async ({ page }) => {
  await installCommonRoutes(page);
  const overdue = {
    ...makeArgumentBuilderRequest(),
    status: 'started',
    startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  };
  let requests = [overdue];
  let submittedBody: Record<string, unknown> | null = null;
  let deleted = false;
  await page.route(`**/api/accounts/cases/${caseId}/requests?requestType=argument-builder`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(requests) }),
  );
  await page.route(`**/api/accounts/cases/${caseId}/argument-builder/submit`, async (route) => {
    submittedBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route(`**/api/accounts/cases/${caseId}/requests/${requestId}`, async (route) => {
    deleted = route.request().method() === 'DELETE';
    requests = [];
    await route.fulfill({ status: 204, body: '' });
  });
  await page.goto(`/cases/${caseId}/argument-builder`);
  await expect(page.getByText('overdue', { exact: true })).toBeVisible();
  await expect(page.locator(`a[href="/cases/${caseId}/argument-builder/${requestId}"]`)).toHaveCount(0);
  await page.getByRole('button', { name: /Actions for argument/ }).click();
  await page.getByRole('menuitem', { name: 'Resubmit' }).click();
  await expect.poll(() => submittedBody).toMatchObject({ requestText: overdue.input });
  await page.getByRole('button', { name: /Actions for argument/ }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(page.getByRole('heading', { name: 'Delete request?' })).toBeVisible();
  expect(deleted).toBe(false);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Delete request?' })).toHaveCount(0);
  expect(deleted).toBe(false);
  await page.getByRole('button', { name: /Actions for argument/ }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog', { name: 'Delete request?' })).toHaveCount(0);
  expect(deleted).toBe(false);
  await page.getByRole('button', { name: /Actions for argument/ }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('dialog', { name: 'Delete request?' }).getByRole('button', { name: 'Delete' }).click();
  await expect.poll(() => deleted).toBe(true);
  await expect(page.getByText(overdue.input)).toHaveCount(0);
});

test('locks argument navigation for guests when canGenerateDeclaration is false', async ({
  page,
}) => {
  await installCommonRoutes(page, {
    isGuest: true,
    canGenerateDeclaration: false,
  });

  await page.route(
    `**/api/accounts/cases/${caseId}/requests?requestType=argument-builder`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
  );

  const caseDetailsResponse = waitForCaseDetailsResponse(page);
  await page.goto(`/cases/${caseId}/argument-builder`);
  await caseDetailsResponse;
  await expect(page).toHaveURL(`/cases/${caseId}`, { timeout: 15_000 });
  await expect(
    page.getByRole('heading', { name: 'Case Details' }),
  ).toBeVisible();

  const caseTabs = page.locator('nav[aria-label="Case navigation"]');
  await expect(
    caseTabs.getByRole('link', { name: 'View Arguments' }),
  ).toHaveCount(0);
  await expect(
    caseTabs.getByRole('link', { name: 'Prepare Argument' }),
  ).toHaveCount(0);
  await expect(
    caseTabs.getByRole('link', { name: 'View Declarations' }),
  ).toHaveCount(0);
  await expect(
    caseTabs.getByRole('link', { name: 'Prepare Declaration' }),
  ).toHaveCount(0);
});

test('shows argument navigation for guests when canGenerateDeclaration is true', async ({
  page,
}) => {
  await installCommonRoutes(page, {
    isGuest: true,
    canGenerateDeclaration: true,
  });

  await page.route(
    `**/api/accounts/cases/${caseId}/requests?requestType=argument-builder`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
  );

  await page.goto(`/cases/${caseId}/argument-builder`);
  await expect(page).toHaveURL(`/cases/${caseId}/argument-builder`);
  await expect(page.getByRole('heading', { name: 'Arguments' })).toBeVisible();

  const caseTabs = page.locator('nav[aria-label="Case navigation"]');
  await expect(
    caseTabs.getByRole('link', { name: 'View Arguments' }),
  ).toBeVisible();
  await expect(
    caseTabs.getByRole('link', { name: 'Prepare Argument' }),
  ).toBeVisible();
  await expect(
    caseTabs.getByRole('link', { name: 'View Declarations' }),
  ).toBeVisible();
  await expect(
    caseTabs.getByRole('link', { name: 'Prepare Declaration' }),
  ).toBeVisible();
});
