import { expect, test, type Page } from '@playwright/test';
import { installMockAuthRuntimeDependencies } from './fixtures/auth';

const notificationsCountApi = '**/api/accounts/notifications/count**';
const negotiateApi = '**/api/realtime/negotiate';
const userAccessApi = '**/api/accounts/access**';
const initializeAccountApi = '**/api/accounts/initialize**';
const enableAccountsApi = '**/api/accounts/cases/enable**';
const casesApi = '**/api/accounts/cases**';
const profilePhotoApi = '**/api/accounts/profile/photo**';
const feedbackApi = '**/api/accounts/cases/**/feedback';

async function installCommonAppRoutes(page: Page) {
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

  await page.route(casesApi, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    await route.continue();
  });

  await page.route(profilePhotoApi, (route) =>
    route.fulfill({
      status: 404,
      body: '',
    }),
  );
}

test.describe('Feedback', () => {
  test.beforeEach(async ({ page }) => {
    await installCommonAppRoutes(page);
  });

  test('opens nav feedback modal and closes it after successful submission', async ({
    page,
  }) => {
    let feedbackPostRequests = 0;

    await page.route(feedbackApi, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      feedbackPostRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/');

    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'Feedback', exact: true })
      .first()
      .click();

    const feedbackDialog = page.getByRole('dialog', {
      name: 'Feedback',
      exact: true,
    });
    const feedbackHeading = feedbackDialog.getByRole('heading', {
      name: 'Feedback',
      exact: true,
    });
    await expect(feedbackHeading).toBeVisible();
    await expect(
      feedbackDialog.getByRole('heading', { name: 'Feedback Details' }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Share feedback about the app. Screenshots are not included from this form.',
      ),
    ).toBeVisible();

    // Nav feedback should open the custom modal, not trigger the screenshot widget flow.
    await expect(page.locator('.rrn-form')).toHaveCount(0);

    await page.locator('#feedback-message').fill('E2E feedback submission from modal');
    await page.getByRole('button', { name: 'Send Feedback' }).click();

    await expect.poll(() => feedbackPostRequests).toBe(1);
    await expect(feedbackHeading).toBeHidden();
  });

  test('feedback mode uses updated placeholder and hides email for signed-in users', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByText('Feedback Mode', { exact: true }).click();
    await page.locator('main').click({ position: { x: 80, y: 80 } });

    const newPlaceholder =
      "What's the issue?  The better you describe it, the better the product can get.";

    const feedbackForm = page.locator('.rrn-form');
    await expect(feedbackForm).toBeVisible({ timeout: 20000 });
    await expect(page.getByPlaceholder(newPlaceholder, { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Email Address — Optional')).toHaveCount(0);
  });
});
