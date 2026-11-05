import { expect, test } from '@playwright/test';

test.describe('Title component', () => {
  test('renders logo, company name, title, and subtitle', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Pro Bono Law', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'An AI Dossier Analyst',
        exact: true,
        level: 1,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'What if you could give every client the attention of your best client, without the resource hours?',
        { exact: true },
      ),
    ).toBeVisible();

    await expect(page.getByAltText('ProBono-Law logo').first()).toBeVisible();
  });

  test('links to the ProBonoLaw GitHub organization', async ({
    page,
  }) => {
    await page.goto('/');

    const projectLink = page.getByRole('link', { name: 'ProBonoLaw on GitHub', exact: true });
    await expect(projectLink).toBeVisible();
    await expect(projectLink).toHaveAttribute('href', 'https://github.com/ProBonoLaw');
  });
});
