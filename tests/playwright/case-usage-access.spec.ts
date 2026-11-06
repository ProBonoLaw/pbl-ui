import { expect, test, type Page } from '@playwright/test';
import { installMockAuthRuntimeDependencies } from './fixtures/auth';

const caseId = '00000000-0000-4000-8000-000000001050';

async function installCaseUsageRoutes(page: Page, isGuest = false) {
  await installMockAuthRuntimeDependencies(page);
  await page.route('**/api/accounts/cases/' + caseId, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '00000000-0000-4000-8000-000000001051',
        accountId: '00000000-0000-4000-8000-000000001052',
        emailAddresses: ['e2e.user@example.com'],
        oids: ['00000000-0000-4000-8000-000000001053'],
        agreedToTerms: true,
        isActive: true,
        casesAccounts: [
          {
            accountId: caseId,
            caseNumber: 'CN-E2E-USAGE',
            agreedToCaseTerms: true,
            isGuest,
            canUseQA: true,
            canGenerateDeclaration: true,
            canAccessDocuments: true,
          },
        ],
      }),
    }),
  );
}

test('shows the no usage state to a case owner', async ({ page }) => {
  await installCaseUsageRoutes(page);
  await page.route(
    '**/api/accounts/cases/' + caseId + '/usage/summary**',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          llmStats: {
            locations: {},
            grandTotalInputTokens: 0,
            grandTotalOutputTokens: 0,
            grandTotalReasoningTokens: 0,
            overallGrandTotalTokens: 0,
          },
          queryTimingMetrics: [],
        }),
      }),
  );

  await page.goto('/cases/' + caseId + '/usage');
  await expect(
    page.getByRole('heading', { name: 'Case Statistics' }),
  ).toBeVisible();
  await expect(page.getByText('No usage data available.')).toBeVisible();
});

test('returns guests to case details when they open case usage', async ({
  page,
}) => {
  await installCaseUsageRoutes(page, true);
  await page.goto('/cases/' + caseId + '/usage');

  await expect(page).toHaveURL('/cases/' + caseId);
});
