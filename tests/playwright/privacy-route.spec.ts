import { expect, test } from '@playwright/test';

test.describe('Privacy route', () => {
  test('renders privacy page with policy and SOC 2 report links', async ({
    page,
  }) => {
    await page.goto('/privacy');

    await expect(
      page.getByRole('heading', {
        name: 'ProBono Law privacy policies',
        exact: true,
      }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-page-background]')).toHaveCount(2);
    await expect(
      page.getByRole('heading', { name: 'SOC 2 Type 2', exact: true }),
    ).toBeVisible();
    const privacyPolicyCard = page
      .locator('.grid .rounded-lg', {
        has: page.getByRole('heading', {
          name: 'Privacy policy',
          exact: true,
        }),
      })
      .first();

    await expect(
      privacyPolicyCard.getByText(
        /Covers account, billing, visitor, and support data/i,
      ),
    ).toBeVisible();
    await expect(
      privacyPolicyCard.getByText(/Uploaded client and case materials/i),
    ).toBeVisible();
    await expect(
      privacyPolicyCard.getByText(/do not sell personal data/i),
    ).toBeVisible();
    const securityControlsCard = page
      .locator('.grid .rounded-lg', {
        has: page.getByRole('heading', {
          name: 'Security controls',
          exact: true,
        }),
      })
      .first();

    await expect(
      securityControlsCard.getByText(/confidentiality, integrity, and availability/i),
    ).toBeVisible();
    await expect(
      securityControlsCard.getByText(/encrypted in transit and at rest/i),
    ).toBeVisible();
    await expect(
      securityControlsCard.getByText(/multi-factor authentication/i),
    ).toBeVisible();
    await expect(
      securityControlsCard.getByText(/vulnerability scanning/i),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'View SOC 2 Type 2 report' }),
    ).toHaveAttribute('href', '/api/privacy/soc-2-type-2-report');
  });
});
