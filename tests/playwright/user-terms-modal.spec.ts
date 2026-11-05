import { expect, test, type Page } from '@playwright/test';
import {
  installMockAuthRuntimeDependencies,
  makeMockGraphProfile,
} from './fixtures/auth';

const casesApi = '**/api/accounts/cases';
const termsApi = '**/api/accounts/terms**';
const demoOfferApi = '**/api/accounts/demo-offer**';
const notificationsCountApi = '**/api/accounts/notifications/count**';
const negotiateApi = '**/api/realtime/negotiate';
const userAccessApi = '**/api/accounts/access**';
const initializeAccountApi = '**/api/accounts/initialize**';
const enableAccountsApi = '**/api/accounts/cases/enable**';
const graphMeApi = 'https://graph.microsoft.com/beta/me';
const graphPhotoApi = 'https://graph.microsoft.com/beta/me/photo/$value';

async function installUserTermsRoutes(
  page: Page,
  options: { isActive?: boolean; shouldOfferDemo?: boolean } = {},
) {
  await installMockAuthRuntimeDependencies(page);

  await page.route(graphMeApi, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeMockGraphProfile()),
    }),
  );
  await page.route(graphPhotoApi, (route) => route.fulfill({ status: 404 }));
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
      body: JSON.stringify({ url: 'wss://example.com/e2e' }),
    }),
  );
  await page.route(userAccessApi, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        agreedToTerms: false,
        isActive: options.isActive ?? true,
      }),
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
  await page.route(casesApi, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );
  await page.route(termsApi, (route) => {
    const isEndClient =
      new URL(route.request().url()).searchParams.get('userType') ===
      'end-client';
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        title: isEndClient ? 'End-Client Terms' : 'Terms of Service',
        effectiveDate: isEndClient ? 'July 11, 2026' : 'December 1, 2025',
        markdown: isEndClient
          ? 'These are the end-client terms shown in the clickwrap viewer.'
          : 'These are the user account terms.',
        acknowledgement: isEndClient
          ? 'By clicking I Accept, you agree to the Pro Bono Law End-Client Terms.'
          : 'I have read and agree to the Pro Bono Law Terms of Service.',
      }),
    });
  });
  await page.route(demoOfferApi, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          shouldOffer: options.shouldOfferDemo === true,
          demoAccountCount: options.shouldOfferDemo === true ? 1 : 0,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ installed: 0 }),
    });
  });
}

test('declining user terms signs the user out', async ({ page }) => {
  await installUserTermsRoutes(page);

  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Terms of Service' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Decline' }).click();

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              __PB_LOGOUT_REDIRECT_CALLED__?: boolean;
            }
          ).__PB_LOGOUT_REDIRECT_CALLED__ === true,
      ),
    )
    .toBe(true);
});

test('user terms are required when navigating directly to profile', async ({
  page,
}) => {
  await installUserTermsRoutes(page);

  await page.goto('/profile');

  await expect(
    page.getByRole('heading', { name: 'Terms of Service' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'User Profile' })).toHaveCount(
    0,
  );
});

test('public agreement pages remain viewable before accepting user terms', async ({
  page,
}) => {
  await installUserTermsRoutes(page);

  await page.goto('/terms');

  await expect(
    page.getByRole('heading', { name: 'Terms of Service', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'I Accept' })).toHaveCount(0);
});

test('non-attorney selection loads end-client terms in the same viewer', async ({
  page,
}) => {
  await installUserTermsRoutes(page);

  await page.goto('/');
  await page.getByLabel('a non-attorney end client').check();

  await expect(
    page.getByRole('heading', { name: 'End-Client Terms' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'These are the end-client terms shown in the clickwrap viewer.',
    ),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test('offers demo cases after inactive new user accepts terms', async ({
  page,
}) => {
  await installUserTermsRoutes(page, {
    isActive: false,
    shouldOfferDemo: true,
  });

  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Terms of Service' }),
  ).toBeVisible();
  await page
    .getByLabel(/By clicking I Accept, you agree to the Pro Bono Law Terms/)
    .check();
  await page.getByRole('button', { name: 'I Accept' }).click();

  await expect(
    page.getByRole('heading', { name: 'Try Demo Cases' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Install Demo Cases' }),
  ).toBeVisible();
});
