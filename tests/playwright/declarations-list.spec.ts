import { expect, test, type Page } from '@playwright/test';
import { installMockAuthRuntimeDependencies } from './fixtures/auth';

const caseId = '00000000-0000-4000-8000-000000001054';

async function installRoutes(page: Page) {
  await installMockAuthRuntimeDependencies(page);
  await page.route('**/api/accounts/cases/' + caseId, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '00000000-0000-4000-8000-000000001055',
        accountId: '00000000-0000-4000-8000-000000001056',
        emailAddresses: ['e2e.user@example.com'],
        oids: ['00000000-0000-4000-8000-000000001057'],
        agreedToTerms: true,
        isActive: true,
        casesAccounts: [
          {
            accountId: caseId,
            caseNumber: 'CN-E2E-DECLARATIONS',
            agreedToCaseTerms: true,
            isGuest: false,
            canUseQA: true,
            canGenerateDeclaration: true,
            canAccessDocuments: true,
          },
        ],
      }),
    }),
  );
  await page.route(
    '**/api/accounts/cases/' + caseId + '/requests?requestType=declaration',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
  );
}

test('shows the declarations list and its create action when no requests exist', async ({
  page,
}) => {
  await installRoutes(page);
  await page.goto('/cases/' + caseId + '/declarations');

  await expect(page.getByRole('heading', { name: 'Declarations' })).toBeVisible();
  await expect(
    page.getByRole('note', { name: 'AI output warning' }),
  ).toHaveText('AI-generated. May be inaccurate. Verify before relying on outputs.');
  await expect(
    page.getByRole('link', { name: 'Create New Declaration' }),
  ).toHaveAttribute('href', '/cases/' + caseId + '/declarations/request');
  const emptyList = page.getByRole('list').filter({ hasText: 'No declarations yet.' });
  await expect(emptyList.getByRole('listitem')).toHaveCount(1);
});

test('Refresh loads newly returned declarations', async ({ page }) => {
  await installRoutes(page);
  let requests: Record<string, unknown>[] = [];
  let fetchCount = 0;
  await page.route(
    '**/api/accounts/cases/' + caseId + '/requests?requestType=declaration',
    (route) => {
      fetchCount += 1;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(requests) });
    },
  );

  await page.goto('/cases/' + caseId + '/declarations');
  await expect(page.getByText('No declarations yet.')).toBeVisible();
  requests = [{
    id: '00000000-0000-4000-8000-000000001066',
    accountId: caseId,
    sessionId: '00000000-0000-4000-8000-000000001067',
    input: 'Newly returned declaration.',
    type: 'declaration',
    status: 'completed',
    oid: '00000000-0000-4000-8000-000000001063',
    startedAt: '2026-09-24T12:00:00.000Z',
  }];
  await page.locator('[data-slot="case-page-actions"]').getByRole('button', { name: 'Refresh' }).click();
  await expect.poll(() => fetchCount).toBe(2);
  await expect(page.getByText('Newly returned declaration.')).toBeVisible();
});

test('resubmitting a declaration refreshes its history', async ({ page }) => {
  await installRoutes(page);
  const original = {
    id: '00000000-0000-4000-8000-000000001068',
    accountId: caseId,
    sessionId: '00000000-0000-4000-8000-000000001069',
    input: 'Original declaration.',
    type: 'declaration',
    status: 'failed',
    oid: '00000000-0000-4000-8000-000000001063',
    startedAt: '2026-09-24T12:00:00.000Z',
  };
  const resubmitted = {
    ...original,
    id: '00000000-0000-4000-8000-000000001070',
    input: 'Resubmitted declaration.',
    status: 'started',
  };
  let requests = [original];
  let fetchCount = 0;
  let submittedBody: Record<string, unknown> | null = null;
  await page.route(
    '**/api/accounts/cases/' + caseId + '/requests?requestType=declaration',
    (route) => {
      fetchCount += 1;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(requests) });
    },
  );
  await page.route('**/api/accounts/cases/' + caseId + '/declarations/submit', async (route) => {
    submittedBody = route.request().postDataJSON() as Record<string, unknown>;
    requests = [original, resubmitted];
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/cases/' + caseId + '/declarations');
  await expect(page.getByText(original.input)).toBeVisible();
  await page.getByRole('button', { name: /Actions for declaration/ }).click();
  await page.getByRole('menuitem', { name: 'Resubmit' }).click();
  await expect.poll(() => submittedBody).toMatchObject({ requestText: original.input });
  await expect.poll(() => fetchCount).toBe(2);
  await expect(page.getByText(resubmitted.input)).toBeVisible();
});

test('declaration list filters by request text and status', async ({ page }) => {
  await installRoutes(page);
  const requests = [
    {
      id: '00000000-0000-4000-8000-000000001058',
      accountId: caseId,
      sessionId: '00000000-0000-4000-8000-000000001059',
      input: 'Prepare housing declaration.',
      type: 'declaration',
      status: 'completed',
      oid: '00000000-0000-4000-8000-000000001060',
      startedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: '00000000-0000-4000-8000-000000001061',
      accountId: caseId,
      sessionId: '00000000-0000-4000-8000-000000001062',
      input: 'Prepare employment declaration.',
      type: 'declaration',
      status: 'failed',
      oid: '00000000-0000-4000-8000-000000001063',
      startedAt: '2026-01-02T00:00:00.000Z',
    },
  ];
  await page.route(
    '**/api/accounts/cases/' + caseId + '/requests?requestType=declaration',
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(requests) }),
  );

  await page.goto('/cases/' + caseId + '/declarations');
  const filters = page.locator('[data-slot="case-page-actions"]').getByRole('search', { name: 'declarations filters' });
  await expect(filters.getByText('Search', { exact: true })).toHaveCount(0);
  await expect(filters.getByText('Status', { exact: true })).toHaveCount(0);
  await filters.getByRole('searchbox', { name: 'Search declarations' }).fill('housing');
  await expect(page.getByText('Prepare housing declaration.')).toBeVisible();
  await expect(page.getByText('Prepare employment declaration.')).toHaveCount(0);

  await filters.getByRole('combobox', { name: 'Status' }).selectOption('failed');
  await expect(page.getByText('No matching declarations.')).toBeVisible();

  await filters.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByText('Prepare employment declaration.')).toBeVisible();
});

test('a pending declaration has actions and no View link', async ({ page }) => {
  await installRoutes(page);
  const requestId = '00000000-0000-4000-8000-000000001064';
  await page.route(
    '**/api/accounts/cases/' + caseId + '/requests?requestType=declaration',
    (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: requestId,
        accountId: caseId,
        sessionId: '00000000-0000-4000-8000-000000001065',
        input: 'Pending declaration.',
        type: 'declaration',
        status: 'generated',
        oid: '00000000-0000-4000-8000-000000001063',
        startedAt: '2026-09-24T12:00:00.000Z',
      }]),
    }),
  );

  await page.goto('/cases/' + caseId + '/declarations');
  await expect(page.getByText('Pending declaration.')).toBeVisible();
  await expect(page.locator(`a[href="/cases/${caseId}/declarations/${requestId}"]`)).toHaveCount(0);
  await page.getByRole('button', { name: /Actions for declaration/ }).click();
  await expect(page.getByRole('menuitem', { name: 'Resubmit' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
});
