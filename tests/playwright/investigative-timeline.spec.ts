import { expect, test, type Page } from '@playwright/test';
import { installMockAuthRuntimeDependencies } from './fixtures/auth';

const caseId = '00000000-0000-4000-8000-000000001041';

async function installRoutes(page: Page) {
  await installMockAuthRuntimeDependencies(page);
  await page.route('**/api/accounts/cases/' + caseId, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '00000000-0000-4000-8000-000000001042',
        accountId: '00000000-0000-4000-8000-000000001043',
        emailAddresses: ['e2e.user@example.com'],
        oids: ['00000000-0000-4000-8000-000000001044'],
        agreedToTerms: true,
        isActive: true,
        casesAccounts: [
          {
            accountId: caseId,
            caseNumber: 'CN-E2E-INVESTIGATIVE',
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
}

test('submits investigative timeline instructions and refreshes history', async ({
  page,
}) => {
  await installRoutes(page);
  let submittedBody: Record<string, unknown> | undefined;
  let historyRequests = 0;

  await page.route(
    '**/api/accounts/cases/' + caseId + '/requests?requestType=timeline-builder',
    async (route) => {
      historyRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    },
  );
  await page.route(
    '**/api/accounts/cases/' + caseId + '/timeline/submit',
    async (route) => {
      submittedBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 202, body: '' });
    },
  );

  await page.goto('/cases/' + caseId + '/timeline/investigative');
  await expect(
    page.getByRole('heading', { name: 'Past investigative timelines' }),
  ).toBeVisible();
  await expect(
    page.getByText('No investigative timelines have been submitted yet.'),
  ).toBeVisible();

  await page.getByLabel('Timeline instructions').fill(
    'Find the key events and supporting documents.',
  );
  await page
    .getByRole('button', { name: 'Start investigative timeline' })
    .click();
  await expect.poll(() => submittedBody).toMatchObject({
    requestText: 'Find the key events and supporting documents.',
  });
  await expect(
    page.getByRole('heading', { name: 'Investigative Timeline Submitted' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect.poll(() => historyRequests).toBeGreaterThan(1);

  await page.getByLabel('Timeline instructions').fill('Temporary instructions');
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByLabel('Timeline instructions')).toHaveValue('');

  const modeNavigation = page.getByRole('navigation', {
    name: 'Timeline build mode',
  });
  await expect(
    modeNavigation.getByRole('link', { name: /Investigative/ }),
  ).toHaveAttribute('aria-current', 'page');
  await modeNavigation.getByRole('link', { name: /Realtime/ }).click();
  await expect(page).toHaveURL('/cases/' + caseId + '/timeline/realtime');
  await expect(
    page.getByRole('button', { name: 'Build realtime timeline' }),
  ).toBeVisible();
});

test('loads a saved investigative timeline failure state', async ({ page }) => {
  await installRoutes(page);
  const requestId = '00000000-0000-4000-8000-000000001045';
  await page.route(
    '**/api/accounts/cases/' + caseId + '/requests/' + requestId,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: requestId,
          accountId: caseId,
          sessionId: '00000000-0000-4000-8000-000000001046',
          input: 'Find important events.',
          type: 'timeline-builder',
          status: 'failed',
          oid: '00000000-0000-4000-8000-000000001047',
          startedAt: '2026-08-01T12:00:00.000Z',
        }),
      }),
  );

  await page.goto(
    '/cases/' + caseId + '/timeline/investigative/' + requestId,
  );

  await expect(
    page.locator('p[role="alert"]'),
  ).toHaveText(
    'This investigative timeline failed to generate. Please try again.',
  );
  await expect(
    page.getByRole('heading', { name: 'Past investigative timelines' }),
  ).toBeVisible();
});

test('overdue timeline has actions but no View link', async ({ page }) => {
  await installRoutes(page);
  const requestId = '00000000-0000-4000-8000-000000001048';
  await page.route(
    '**/api/accounts/cases/' + caseId + '/requests?requestType=timeline-builder',
    (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: requestId,
        accountId: caseId,
        sessionId: '00000000-0000-4000-8000-000000001049',
        input: 'Investigate overdue events.',
        type: 'timeline-builder',
        status: 'started',
        oid: '00000000-0000-4000-8000-000000001047',
        startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      }]),
    }),
  );

  await page.goto('/cases/' + caseId + '/timeline/investigative');
  await expect(page.getByText('overdue', { exact: true })).toBeVisible();
  await expect(page.locator(`a[href="/cases/${caseId}/timeline/investigative/${requestId}"]`)).toHaveCount(0);
  await page.getByRole('button', { name: /Actions for timeline/ }).click();
  await expect(page.getByRole('menuitem', { name: 'Resubmit' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
});


test('opens the realtime builder from the case timeline index', async ({
  page,
}) => {
  await installRoutes(page);
  await page.goto('/cases/' + caseId + '/timeline');

  await expect(page).toHaveURL('/cases/' + caseId + '/timeline/realtime');
  await expect(
    page.getByRole('button', { name: 'Build realtime timeline' }),
  ).toBeVisible();
});
