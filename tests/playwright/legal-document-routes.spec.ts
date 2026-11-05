import { expect, test } from '@playwright/test';

test.describe('Public legal document routes', () => {
  for (const route of ['terms', 'baa', 'dpa', 'aup', 'end-client-terms']) {
    test(`renders the shared background on /${route}`, async ({ page }) => {
      await page.goto(`/${route}`);

      await expect(page.locator('[data-page-background]')).toHaveCount(2);
      await expect(page.locator('article')).toBeVisible();
    });
  }
});
