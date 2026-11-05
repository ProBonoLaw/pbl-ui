import { expect, type Page } from '@playwright/test';
import {
  installMockAuthRuntimeDependencies,
  makeMockGraphProfile,
} from './auth';

const graphMeApi = 'https://graph.microsoft.com/beta/me';
const graphPhotoApi = 'https://graph.microsoft.com/beta/me/photo/$value';
export const profileApi = '**/api/accounts/profile';
export const barAdmissionsApi = '**/api/accounts/profile/bar-admissions';
const jurisdictionsApi = '**/api/jurisdictions';

const jurisdictionsResponse = {
  states: [
    {
      jurisdictionCode: 'IL',
      countryCode: 'US',
      name: 'Illinois',
      type: 'State',
    },
    {
      jurisdictionCode: 'OK',
      countryCode: 'US',
      name: 'Oklahoma',
      type: 'State',
    },
    {
      jurisdictionCode: 'WA',
      countryCode: 'US',
      name: 'Washington',
      type: 'State',
    },
  ],
  federal: [
    {
      jurisdictionCode: 'OKND',
      countryCode: 'US',
      courtType: 'DistrictCourt',
      jurisdictionType: 'Federal',
      name: 'U.S. District Court for the Northern District of Oklahoma',
      stateCode: 'OK',
      circuitCode: '10',
      nationwide: false,
    },
  ],
  tribal: [
    {
      jurisdictionCode: 'CHEROKEE-NATION',
      countryCode: 'US',
      federallyRecognized: true,
      jurisdictionType: 'Tribal',
      name: 'Cherokee Nation',
    },
  ],
};

export async function installProfileRoutes(
  page: Page,
  onJurisdictionRequest?: () => void,
) {
  await installMockAuthRuntimeDependencies(page);

  await page.route(graphMeApi, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        makeMockGraphProfile({
          state: 'Illinois',
          extension_example_IsAttorney: true,
          isAttorney: true,
        }),
      ),
    }),
  );
  await page.route(graphPhotoApi, (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
  await page.route(jurisdictionsApi, async (route) => {
    onJurisdictionRequest?.();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(jurisdictionsResponse),
    });
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

    await route.continue();
  });
}

export async function chooseCombobox(
  page: Page,
  name: string,
  query: string,
  optionName: string,
  index = 0,
) {
  const combobox = page.locator(`input[aria-label="${name}"]`).nth(index);
  await combobox.fill(query);
  await expect(page.getByRole('option', { name: optionName })).toBeVisible();
  await page.getByRole('option', { name: optionName }).click();
}
