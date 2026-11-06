import { expect, test } from '@playwright/test';
import {
  chooseCombobox,
  installProfileRoutes,
  profileApi,
} from './fixtures/profile-jurisdictions';

test.describe('SearchableSelect component', () => {
  test('filters by label or value and supports keyboard selection', async ({
    page,
  }) => {
    await installProfileRoutes(page);
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Edit' }).click();

    const state = page.getByRole('combobox', {
      name: 'State, territory, or district',
    });
    await state.fill(' wA ');
    await expect(
      page.getByRole('option', { name: 'Washington (State)' }),
    ).toBeVisible();
    await expect(page.getByRole('option')).toHaveCount(1);

    await state.press('ArrowDown');
    await state.press('Enter');
    await expect(state).toHaveValue('Washington (State)');
    await page
      .getByRole('button', {
        name: 'Show State, territory, or district options',
      })
      .click();
    await expect(page.getByRole('option')).toHaveCount(3);
    await expect(page.getByText('No matching options.')).toHaveCount(0);
  });

  test('shows its configured empty message and filters again after editing the query', async ({
    page,
  }) => {
    await installProfileRoutes(page);
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('button', { name: 'Add admission' }).click();

    const jurisdiction = page.getByRole('combobox', { name: 'Jurisdiction', exact: true });
    await jurisdiction.fill('not a jurisdiction');
    await expect(
      page.getByText('No jurisdictions match your search.'),
    ).toBeVisible();
    await expect(page.getByRole('option')).toHaveCount(0);

    await jurisdiction.fill('okla');
    await expect(
      page.getByRole('option', { name: 'Oklahoma (State)' }),
    ).toBeVisible();
    await page.getByRole('option', { name: 'Oklahoma (State)' }).click();
    await expect(jurisdiction).toHaveValue('Oklahoma (State)');
  });

  test('disables its input and options while the profile is saving', async ({
    page,
  }) => {
    await installProfileRoutes(page);
    let patchStarted = false;
    let patchedProfile: Record<string, unknown> | undefined;
    let patchFinished = false;

    await page.route(profileApi, async (route) => {
      if (route.request().method() === 'PATCH') {
        patchStarted = true;
        patchedProfile = JSON.parse(route.request().postData() ?? '{}') as Record<
          string,
          unknown
        >;
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await route.fulfill({ status: 204, body: '' });
        patchFinished = true;
        return;
      }
      await route.continue();
    });

    await page.goto('/profile');
    await page.getByRole('button', { name: 'Edit' }).click();
    const state = page.getByRole('combobox', {
      name: 'State, territory, or district',
    });
    await chooseCombobox(
      page,
      'State, territory, or district',
      'WA',
      'Washington (State)',
    );
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect.poll(() => patchStarted).toBe(true);
    await expect(state).toBeDisabled();
    await expect(
      page.getByRole('button', {
        name: 'Show State, territory, or district options',
      }),
    ).toBeDisabled();
    await expect.poll(() => patchFinished).toBe(true);
    await expect.poll(() => patchedProfile?.state).toBe('Washington');
  });
});
