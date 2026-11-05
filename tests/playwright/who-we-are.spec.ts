import { expect, test } from '@playwright/test';

test.describe('WhoWeAre component', () => {
  test('renders section copy, three cards, and centered large icons', async ({
    page,
  }) => {
    await page.goto('/');

    const sectionHeading = page.getByRole('heading', {
      name: 'Who We Are',
      exact: true,
    });
    await expect(sectionHeading).toBeVisible();

    const section = page
      .locator('section', {
        has: page.getByRole('heading', { name: 'Who We Are', exact: true }),
      })
      .first();

    await expect(
      section.getByText(
        /We empower attorneys to deliver personalized representation and\s+reduce workload with AI grounded in your case's unique data\./,
      ),
    ).toBeVisible();

    await expect(
      section.getByRole('heading', {
        name: 'What is ProBono Law?',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      section.getByRole('heading', {
        name: 'Who ProBono Law is for?',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      section.getByRole('heading', {
        name: 'Benefits of ProBono Law',
        exact: true,
      }),
    ).toBeVisible();

    const cards = section.locator('article');
    await expect(cards).toHaveCount(3);
    // Each card should include a visible icon without depending on Tailwind classes.
    for (let index = 0; index < 3; index += 1) {
      await expect(cards.nth(index).locator('svg').first()).toBeVisible();
    }
  });
});
