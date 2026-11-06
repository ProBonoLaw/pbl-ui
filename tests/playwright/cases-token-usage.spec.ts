import { expect, test } from '@playwright/test';
import { installMockAuthRuntimeDependencies } from './fixtures/auth';

const usageApi = '**/api/accounts/cases/usage**';
const notificationsCountApi = '**/api/accounts/notifications/count**';
const negotiateApi = '**/api/realtime/negotiate';
const userAccessApi = '**/api/accounts/access**';
const initializeAccountApi = '**/api/accounts/initialize**';
const enableAccountsApi = '**/api/accounts/cases/enable**';

test.describe('Token Usage page', () => {
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
  });

  test('renders token usage rows and calculated totals', async ({ page }) => {
    await page.route(usageApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            accountId: '00000000-0000-4000-8000-000000001098',
            caseNumber: 'CASE-100',
            billingCode: 'S1',
            llmUsage: [
              {
                accountId: '00000000-0000-4000-8000-000000001098',
                model: 'gpt-5',
                llmType: 'azure-openai-chat',
                inputTokens: 1_000_000,
                outputTokens: 2_000_000,
                reasoningTokens: 50_000,
                totalTokens: 3_050_000,
                origin: 'AIMIE',
              },
            ],
          },
        ]),
      }),
    );

    await page.goto('/cases/usage');

    await expect(
      page.getByRole('heading', { name: 'Token Usage' }),
    ).toBeVisible();
    const table = page.getByRole('table');
    await expect(table).toHaveClass(/app-data-table/);
    await expect(table.locator('xpath=..')).toHaveClass(/overflow-x-auto/);
    await expect(page.getByText('Unknown (CASE-100)')).toBeVisible();

    await expect(
      page.getByRole('cell', { name: 'User Interaction' }),
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: 'Azure OpenAI' }),
    ).toBeVisible();

    await expect(
      page.getByRole('cell', { name: '1,000,000' }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: '2,000,000' }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: '50,000' }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: '3,050,000' }).first(),
    ).toBeVisible();

    await expect(page.getByText('Grand Total')).toBeVisible();

    await expect(page.getByRole('cell', { name: '$21.35' })).toHaveCount(2);
  });

  test('calculates Azure GPT and Claude model costs', async ({ page }) => {
    const modelCosts = [
      { model: 'gpt-5.6-luna', cost: '$1.40' },
      { model: 'gpt-5.6-terra', cost: '$14.00' },
      { model: 'gpt-5.6-sol', cost: '$24.00' },
      { model: 'fact-finder-gpt-5.4-mini', cost: '$5.25' },
      { model: 'claude-haiku-4-5', cost: '$6.00' },
      { model: 'claude-sonnet-5', cost: '$12.00' },
      { model: 'claude-opus-5', cost: '$30.00' },
    ];

    await page.route(usageApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            accountId: '00000000-0000-4000-8000-000000001099',
            caseNumber: 'CASE-101',
            billingCode: 'S1',
            llmUsage: modelCosts.map(({ model }) => ({
              accountId: '00000000-0000-4000-8000-000000001099',
              model,
              llmType: model.startsWith('claude')
                ? 'azure-anthropic-chat'
                : 'azure-openai-chat',
              inputTokens: 1_000_000,
              outputTokens: 1_000_000,
              reasoningTokens: 100_000,
              totalTokens: 2_000_000,
              origin: 'AIMIE',
            })),
          },
        ]),
      }),
    );

    await page.goto('/cases/usage');

    for (const { model, cost } of modelCosts) {
      const row = page.getByRole('row').filter({
        has: page.getByRole('cell', { name: model, exact: true }),
      });
      await expect(row.getByRole('cell', { name: cost, exact: true })).toBeVisible();
    }
    await expect(
      page.getByRole('row').filter({ hasText: 'Grand Total' }).getByRole('cell', {
        name: '$92.65',
        exact: true,
      }),
    ).toBeVisible();
  });
});
