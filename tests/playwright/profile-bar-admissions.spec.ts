import { expect, test } from '@playwright/test';
import {
  barAdmissionsApi,
  chooseCombobox,
  installProfileRoutes,
  profileApi,
} from './fixtures/profile-jurisdictions';

test.describe('Profile jurisdiction selectors', () => {
  test('searches and saves the profile State using the jurisdiction reference data', async ({
    page,
  }) => {
    await installProfileRoutes(page);
    let patchedProfile: Record<string, unknown> | null = null;

    await page.route(profileApi, async (route) => {
      if (route.request().method() === 'PATCH') {
        patchedProfile = JSON.parse(route.request().postData() ?? '{}') as Record<
          string,
          unknown
        >;
        await route.fulfill({ status: 204, body: '' });
        return;
      }
      await route.continue();
    });

    await page.goto('/profile');
    await page.getByRole('button', { name: 'Edit' }).click();

    await chooseCombobox(
      page,
      'State, territory, or district',
      'okla',
      'Oklahoma (State)',
    );
    await expect(
      page.getByRole('combobox', { name: 'State, territory, or district' }),
    ).toHaveValue('Oklahoma (State)');

    await chooseCombobox(
      page,
      'State, territory, or district',
      'WA',
      'Washington (State)',
    );
    await expect(
      page.getByRole('combobox', { name: 'State, territory, or district' }),
    ).toHaveValue('Washington (State)');

    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect.poll(() => patchedProfile?.state).toBe('Washington');
  });

  test('uses searchable State, Federal, and Tribal admission selectors', async ({
    page,
  }) => {
    let jurisdictionRequests = 0;
    await installProfileRoutes(page, () => {
      jurisdictionRequests += 1;
    });
    let savedAdmissions: unknown = null;

    await page.route(profileApi, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({ status: 204, body: '' });
        return;
      }
      await route.continue();
    });
    await page.route(barAdmissionsApi, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ barAdmissions: [] }),
        });
        return;
      }
      if (route.request().method() === 'PUT') {
        savedAdmissions = JSON.parse(route.request().postData() ?? '{}');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(savedAdmissions),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/profile');
    await expect.poll(() => jurisdictionRequests).toBe(1);
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('button', { name: 'Add admission' }).click();
    await expect(page.locator('input[aria-label="Jurisdiction"]').first()).toBeVisible();

    await chooseCombobox(
      page,
      'Jurisdiction',
      'okla',
      'Oklahoma (State)',
    );
    await page.getByRole('textbox', { name: 'Bar admission ID' }).click();
    await page.getByRole('textbox', { name: 'Bar admission ID' }).fill('OK-123');

    await page.getByRole('button', { name: 'Add admission' }).click();
    await chooseCombobox(page, 'Jurisdiction type', 'federal', 'Federal', 1);
    await chooseCombobox(
      page,
      'Federal court type',
      'district',
      'District Court',
    );
    await chooseCombobox(
      page,
      'Jurisdiction',
      'northern district',
      'U.S. District Court for the Northern District of Oklahoma',
      1,
    );
    await page.getByRole('textbox', { name: 'Bar admission ID' }).nth(1).click();
    await page.getByRole('textbox', { name: 'Bar admission ID' }).nth(1).fill(
      'OKND-456',
    );

    await page.getByRole('button', { name: 'Add admission' }).click();
    await chooseCombobox(page, 'Jurisdiction type', 'tribal', 'Tribal', 2);
    await chooseCombobox(
      page,
      'Jurisdiction',
      'cherokee',
      'Cherokee Nation (federally recognized)',
      2,
    );
    await page.getByRole('textbox', { name: 'Bar admission ID' }).nth(2).click();
    await page.getByRole('textbox', { name: 'Bar admission ID' }).nth(2).fill(
      'CN-789',
    );

    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect.poll(() => savedAdmissions).toEqual({
      barAdmissions: [
        {
          jurisdictionType: 'State',
          jurisdictionCode: 'OK',
          identifier: 'OK-123',
        },
        {
          jurisdictionType: 'Federal',
          jurisdictionCode: 'OKND',
          identifier: 'OKND-456',
          courtType: 'DistrictCourt',
        },
        {
          jurisdictionType: 'Tribal',
          jurisdictionCode: 'CHEROKEE-NATION',
          identifier: 'CN-789',
        },
      ],
    });
  });

  test('displays jurisdiction names in read-only admissions', async ({ page }) => {
    await installProfileRoutes(page);
    await page.unroute(barAdmissionsApi);
    await page.route(barAdmissionsApi, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            barAdmissions: [
              {
                jurisdictionType: 'State',
                jurisdictionCode: 'OK',
                identifier: 'OK-123',
              },
              {
                jurisdictionType: 'Federal',
                jurisdictionCode: 'OKND',
                identifier: 'OKND-456',
                courtType: 'DistrictCourt',
              },
              {
                jurisdictionType: 'Tribal',
                jurisdictionCode: 'CHEROKEE-NATION',
                identifier: 'CN-789',
              },
            ],
          }),
        });
        return;
      }

      await route.continue();
    });

    await page.goto('/profile');
    await expect(page.getByText('State · Oklahoma', { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        'Federal · U.S. District Court for the Northern District of Oklahoma',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByText('Tribal · Cherokee Nation', { exact: true })).toBeVisible();
    await expect(page.getByText('State · OK', { exact: true })).not.toBeVisible();
  });
});
