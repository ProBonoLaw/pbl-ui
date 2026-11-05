import { expect, type Page, test } from '@playwright/test';
import { installMockAuthRuntimeDependencies } from './fixtures/auth';

const caseId = '00000000-0000-4000-8000-000000001036';

function makeCaseDetailsResponse() {
  return {
    id: '00000000-0000-4000-8000-000000001037',
    accountId: '00000000-0000-4000-8000-000000001038',
    emailAddresses: ['e2e.user@example.com'],
    oids: ['00000000-0000-4000-8000-000000001040'],
    agreedToTerms: true,
    isActive: true,
    casesAccounts: [
      {
        accountId: caseId,
        caseNumber: 'CN-E2E-PARTIAL-TIMELINE',
        agreedToCaseTerms: true,
        isGuest: false,
        canUseQA: true,
        canGenerateDeclaration: true,
        canAccessDocuments: true,
      },
    ],
  };
}

function makePartialTimelineResponse() {
  return {
    sessionId: '00000000-0000-4000-8000-000000001039',
    accountId: caseId,
    tags: ['event'],
    originalRequest: 'Show the case events.',
    entries: [],
    footnotes: [],
    code: 'EVENT_QUERY_PARTIAL_RESULT',
    message: 'Candidate records could not be model-reviewed.',
    retrievalStatus: 'succeeded',
    reviewStatus: 'incomplete',
    retrievedRecordCount: 1,
    retrievedRecords: [
      {
        recordIndex: 0,
        docId: 'doc-1',
        sourceId: 'source-1',
        title: 'Candidate record',
        url: 'https://example.test/candidate-record',
        pages: ['4'],
        tags: ['event'],
        where: null,
        what: 'A candidate event',
        who: ['Client'],
        why: null,
        dateRange: { startDate: '2026-01-01', endDate: null },
        content: 'Unverified candidate content.',
      },
    ],
    failureReasons: ['timeout'],
  };
}

async function installRoutes(page: Page) {
  await installMockAuthRuntimeDependencies(page);

  await page.route(`**/api/accounts/cases/${caseId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeCaseDetailsResponse()),
    }),
  );
  await page.route(`**/api/accounts/cases/${caseId}/timeline`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: makePartialTimelineResponse() }),
    }),
  );
}

test('shows unverified candidate records for a partial realtime timeline', async ({
  page,
}) => {
  await installRoutes(page);
  await page.goto(`/cases/${caseId}/timeline/realtime`);

  await expect(page.getByRole('note', { name: 'AI output warning' })).toHaveText(
    'AI-generated. May be inaccurate. Verify before relying on outputs.',
  );

  await page.getByLabel('Timeline instructions').fill('Show the case events.');
  await page.getByRole('button', { name: 'Build realtime timeline' }).click();

  await expect(
    page.getByRole('heading', {
      name: 'Timeline results could not be verified',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Candidate record' }),
  ).toHaveCount(0);

  await page.getByRole('button', { name: 'View partial results' }).click();

  await expect(
    page.getByRole('heading', { name: 'Unverified candidate records' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Candidate record', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Unverified candidate content.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View source' })).toHaveAttribute(
    'href',
    'https://example.test/candidate-record',
  );
  await expect(
    page.getByRole('heading', { name: 'Timeline results', exact: true }),
  ).toHaveCount(0);
});


test('validates timeline record choices and submits only the selected type', async ({
  page,
}) => {
  await installRoutes(page);
  let submittedBody: Record<string, unknown> | undefined;
  await page.route('**/api/accounts/cases/' + caseId + '/timeline', async (route) => {
    submittedBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 500, body: '' });
  });

  await page.goto('/cases/' + caseId + '/timeline/realtime');
  const events = page.getByRole('checkbox', { name: 'Events' });
  const facts = page.getByRole('checkbox', { name: 'Facts' });
  const submit = page.getByRole('button', { name: 'Build realtime timeline' });

  await events.uncheck();
  await facts.uncheck();
  await expect(submit).toBeDisabled();
  await expect(page.getByText('Choose at least one item type.')).toBeVisible();

  await facts.check();
  await expect(submit).toBeEnabled();
  await page.getByLabel('Timeline instructions').fill('Find factual statements.');
  await submit.click();

  await expect.poll(() => submittedBody).toMatchObject({
    input: 'Find factual statements.',
    tags: ['fact'],
    maxDocCount: 200,
  });
  await expect(page.locator('p[role="alert"]')).toContainText(
    'The realtime timeline could not be generated.',
  );
});
