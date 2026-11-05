import { expect, test, type Page } from '@playwright/test';
import { installMockAuthRuntimeDependencies } from './fixtures/auth';

const staffMember = {
  staffId: 'morgan-counsel',
  displayName: 'Morgan Counsel',
  focus: 'Family law',
  highlight: 'Helps clients understand complex proceedings.',
  experience: 'Ten years of legal practice',
  email: 'morgan@example.test',
  phoneNumber: '+1-555-0100',
  role: 'Staff Attorney',
  title: 'Senior Attorney',
  isCurrent: true,
};

async function installPublicPageRoutes(page: Page) {
  await installMockAuthRuntimeDependencies(page);
  await page.route('**/api/staff', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([staffMember]),
    }),
  );
  await page.route('**/api/staff/morgan-counsel', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(staffMember),
    }),
  );
  await page.route('**/_next/image**', (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
  await page.route('**/api/staff/morgan-counsel/photo', (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
}

async function makeRuntimeSignedOut(page: Page) {
  await page.addInitScript(() => {
    type RuntimeWindow = Window & {
      __PB_RUNTIME_DEPENDENCIES__?: { msalClient?: object };
    };
    const runtime = (window as RuntimeWindow).__PB_RUNTIME_DEPENDENCIES__;
    const client = runtime?.msalClient;
    if (!runtime || !client) return;
    runtime.msalClient = new Proxy(client, {
      get(target, property, receiver) {
        if (property === 'getActiveAccount') return () => null;
        if (property === 'getAllAccounts') return () => [];
        return Reflect.get(target, property, receiver);
      },
    });
  });
}

test('static privacy and agreement deep links retain their content and titles', async ({ page }) => {
  await installPublicPageRoutes(page);
  await page.goto('/privacy');
  await expect(page).toHaveTitle('Privacy and Security | ProBono Law');
  await expect(page.getByRole('heading', { name: 'ProBono Law privacy policies' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'ProBono Law privacy policies' })).toBeVisible();
  await page.goto('/baa');
  await expect(page).toHaveTitle('Business Associate Agreement | ProBono Law');
  await expect(page.getByRole('heading', { name: 'Business Associate Agreement', exact: true })).toBeVisible();
});

test('opening privacy from the homepage resets scroll and Back restores the homepage position', async ({ page }) => {
  await installPublicPageRoutes(page);
  await makeRuntimeSignedOut(page);
  await page.goto('/');
  const link = page.getByRole('link', { name: 'Open privacy page', exact: true });
  await link.scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  const before = await page.evaluate(() => window.scrollY);
  await link.click();
  await expect(page).toHaveURL('/privacy');
  await expect(page.getByRole('heading', { name: 'ProBono Law privacy policies' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.goBack();
  await expect(page).toHaveURL('/');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);
});

test('renders the Our Story screen and its illustrations', async ({ page }) => {
  await installPublicPageRoutes(page);
  await page.goto('/about-us');

  await expect(page.getByRole('heading', { name: 'Our Story' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Time before AIMIE' }),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: 'Juggling Act' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Happy Clients' })).toBeVisible();
});

test('renders the product walkthrough and workspace image', async ({ page }) => {
  await installPublicPageRoutes(page);
  await page.goto('/product');

  await expect(
    page.getByRole('heading', { name: 'How an AI Dossier Analyst works' }),
  ).toBeVisible();
  await expect(
    page.getByText('Upload all records you want analyzed once.'),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'ProBono-Law case workspace displaying fictional example cases' }),
  ).toBeVisible();
});

test('lets visitors open a staff profile from the directory', async ({ page }) => {
  await installPublicPageRoutes(page);
  await page.goto('/staff');

  await expect(
    page.getByRole('heading', { name: /Meet the team building systems/ }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'View profile for Morgan Counsel' }).click();

  await expect(page).toHaveURL('/staff/morgan-counsel', { timeout: 15_000 });
  await expect(
    page.getByRole('heading', { name: 'Morgan Counsel' }),
  ).toBeVisible();
  await expect(page.getByText('Family law')).toBeVisible();
  await expect(page.getByText(staffMember.email)).toHaveCount(0);
  await expect(page.getByText(staffMember.phoneNumber)).toHaveCount(0);
  await expect(page.locator('a[href^="mailto:"], a[href^="tel:"]')).toHaveCount(0);
  await expect(page.getByText('No Photo')).toBeVisible();
});

test('shows the onboarding terms and signup links to signed-out visitors', async ({
  page,
}) => {
  await installMockAuthRuntimeDependencies(page);
  await makeRuntimeSignedOut(page);

  await page.goto('/onboarding');

  await expect(
    page.getByRole('heading', { name: 'Let’s Get Started' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Terms & Conditions' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign Up' })).toHaveAttribute(
    'href',
    /login\.microsoftonline\.com.*prompt=create/,
  );
  await expect(page.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
    'href',
    '/',
  );
});
