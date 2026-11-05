import { expect, test } from '@playwright/test';

test.describe('FAQ route', () => {
  test('provides agreement and policy links in the Legal menu', async ({
    page,
  }) => {
    await page.goto('/faq');

    await page.getByRole('button', { name: 'Open legal menu' }).click();
    const legalMenu = page.getByRole('heading', {
      name: 'Agreements and policies',
    }).locator('..');

    for (const [name, href] of [
      ['Privacy and Security', '/privacy'],
      ['Terms of Service', '/terms'],
      ['Business Associate Agreement', '/baa'],
      ['Data Processing Addendum', '/dpa'],
      ['Acceptable Use Policy', '/aup'],
      ['End-Client Terms', '/end-client-terms'],
    ]) {
      await expect(legalMenu.getByRole('link', { name })).toHaveAttribute(
        'href',
        href,
      );
    }
  });

  test('provides the Legal menu on mobile navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/faq');

    await page.getByRole('button', { name: 'Open main menu' }).click();
    await page.getByRole('button', { name: 'Legal', exact: true }).click();
    await expect(
      page.getByRole('link', { name: 'End-Client Terms', exact: true }),
    ).toHaveAttribute('href', '/end-client-terms');
  });

  test('renders FAQ component content on /faq', async ({ page }) => {
    await page.goto('/faq');

    await expect(page.getByRole('heading', { name: 'FAQ', exact: true })).toBeVisible();
    await expect(page.locator('[data-page-background]')).toHaveCount(2);
    await expect(
      page.getByText('Is my data safe and kept private?', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Does ProBono-Law use my data to train its AI models?', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        /ProBono-Law does not use client data to train AI models\./,
      ),
    ).toBeVisible();
    await expect(
      page.getByText('Can ProBono-Law analyze audio and video files?', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        /Supported video formats are \.mp4, \.mov, \.m4v, \.avi, \.mkv, \.wmv, and \.webm\. Supported audio formats are \.aac, \.aiff, \.amr, \.flac, \.m4a, \.mp3, \.ogg, \.opus, \.wav, and \.wma\./,
      ),
    ).toBeVisible();

    const askLink = page.getByRole('link', {
      name: 'Explore ProBonoLaw on GitHub',
    });
    await expect(askLink).toBeVisible();

    await expect(askLink).toHaveAttribute('href', 'https://github.com/ProBonoLaw');
  });
});
