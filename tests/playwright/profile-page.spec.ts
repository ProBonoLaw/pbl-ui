import { expect, test, type Page } from '@playwright/test';
import { installMockAuthRuntimeDependencies } from './fixtures/auth';
import { GraphUserSchema } from '@/lib/types';

const notificationsCountApi = '**/api/accounts/notifications/count**';
const negotiateApi = '**/api/realtime/negotiate';
const userAccessApi = '**/api/accounts/access**';
const initializeAccountApi = '**/api/accounts/initialize**';
const enableAccountsApi = '**/api/accounts/cases/enable**';
const graphMeApi = 'https://graph.microsoft.com/beta/me';
const graphOwnProfileApi = 'https://graph.microsoft.com/v1.0/me';
const graphPhotoApi = 'https://graph.microsoft.com/beta/me/photo/$value';
const profileApi = '**/api/accounts/profile';
const barAdmissionsApi = '**/api/accounts/profile/bar-admissions';
const profilePhotoApi = '**/api/accounts/profile/photo';

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7p7KsAAAAASUVORK5CYII=',
  'base64',
);

function makeGraphProfile(overrides?: Record<string, unknown>) {
  return GraphUserSchema.parse({
    id: '00000000-0000-4000-8000-000000001086',
    accountEnabled: true,
    createdDateTime: '2026-01-01T00:00:00.000Z',
    displayName: 'Jane Doe',
    givenName: 'Jane',
    surname: 'Doe',
    isLicenseReconciliationNeeded: false,
    mail: 'jane.doe@example.com',
    mailNickname: 'janedoe',
    refreshTokensValidFromDateTime: '2026-01-01T00:00:00.000Z',
    securityIdentifier: 'S-1-5-21-1234567890-123456789-123456789-1234',
    signInSessionsValidFromDateTime: '2026-01-01T00:00:00.000Z',
    userType: 'Member',
    userPrincipalName: 'jane.doe@example.com',
    mobilePhone: '+1-555-0100',
    streetAddress: '123 Main St',
    city: 'Chicago',
    state: 'IL',
    postalCode: '60601',
    country: 'USA',
    extension_example_IsAttorney: true,
    isAttorney: true,
    ...overrides,
  });
}

async function installCommonAppRoutes(page: Page) {
  await installMockAuthRuntimeDependencies(page);

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
      body: JSON.stringify({
        url: 'wss://example.com/e2e',
        groupName: 'notifications',
      }),
    }),
  );

  await page.route(userAccessApi, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ agreedToTerms: true, isActive: true }),
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
    route.fulfill({
      status: 204,
      body: '',
    }),
  );

  await page.route(barAdmissionsApi, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ barAdmissions: [] }),
      });
      return;
    }

    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    await route.continue();
  });
}

test.describe('Profile page', () => {
  test.beforeEach(async ({ page }) => {
    await installCommonAppRoutes(page);
  });

  test('renders profile data and saves edits', async ({ page }) => {
    const profile = makeGraphProfile();
    let patchRequests = 0;
    let patchedPayload: Record<string, unknown> | null = null;
    let patchedPhone: unknown = null;
    let releasePatchResponse: (() => void) | null = null;
    const patchResponseGate = new Promise<void>((resolve) => {
      releasePatchResponse = resolve;
    });

    await page.route(graphMeApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profile),
      }),
    );

    await page.route(graphPhotoApi, (route) =>
      route.fulfill({
        status: 404,
        body: '',
      }),
    );

    await page.route(profileApi, async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = JSON.parse(
          route.request().postData() ?? '{}',
        ) as Record<string, unknown>;
        if (Object.hasOwn(body, 'mobilePhone')) {
          patchedPhone = body;
          await route.fulfill({ status: 204, body: '' });
          return;
        }
        patchRequests += 1;
        patchedPayload = body;

        // Hold the PATCH response until the test verifies saving UI is visible.
        await patchResponseGate;

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ updated: true }),
        });
        return;
      }

      await route.continue();
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/profile');

    await expect(
      page.getByRole('heading', { name: 'User Profile' }),
    ).toBeVisible();
    const headingLeft = await page.getByRole('heading', { name: 'User Profile' }).evaluate((element) =>
      element.getBoundingClientRect().left + parseFloat(getComputedStyle(element).paddingLeft),
    );
    const form = await page.locator('form[aria-busy]').boundingBox();
    expect(form).not.toBeNull();
    expect(Math.abs(headingLeft - form!.x)).toBeLessThan(2);
    await expect(page.locator('input#firstName')).toHaveValue('Jane');
    await expect(page.locator('input#firstName')).toHaveAttribute(
      'readonly',
      '',
    );

    await page.getByRole('button', { name: 'Edit' }).click();

    await expect(
      page.getByRole('button', { name: 'Save Changes' }),
    ).toBeVisible();
    await page.locator('input#firstName').fill('Janet');
    await page.locator('input#phone').fill('+1-555-0101');
    await page.locator('input#isAttorney').uncheck();

    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(
      page.getByText('Saving your profile data. Please wait...'),
    ).toBeVisible();

    const release = releasePatchResponse as (() => void) | null;
    release?.();

    await expect.poll(() => patchRequests).toBe(1);
    await expect.poll(() => patchedPayload?.givenName).toBe('Janet');
    expect(patchedPayload).not.toHaveProperty('mobilePhone');
    await expect.poll(() => patchedPhone).toEqual({
      mobilePhone: '+1-555-0101',
    });
    await expect
      .poll(
        () =>
          patchedPayload?.isAttorney,
      )
      .toBe(false);

    await expect(
      page.getByRole('heading', { name: 'Changes Saved' }),
    ).toBeVisible();
    await expect(
      page.getByText('Your profile changes were saved successfully.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'OK' }).click();

    await expect(
      page.getByRole('heading', { name: 'Changes Saved' }),
    ).toBeHidden();
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Save Changes' }),
    ).toBeHidden();
  });

  test('saves a member phone change through the profile API', async ({
    page,
  }) => {
    const profile = makeGraphProfile({
      isAttorney: false,
      extension_example_IsAttorney: false,
    });
    let profileApiPatches = 0;
    let patchedPhone: unknown = null;
    let directGraphPatches = 0;

    await page.route(graphMeApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profile),
      }),
    );
    await page.route(graphOwnProfileApi, async (route) => {
      directGraphPatches += 1;
      await route.abort();
    });
    await page.route(profileApi, async (route) => {
      if (route.request().method() === 'PATCH') {
        profileApiPatches += 1;
        patchedPhone = JSON.parse(route.request().postData() ?? '{}');
        await route.fulfill({ status: 204, body: '' });
        return;
      }
      await route.continue();
    });

    await page.goto('/profile');
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.locator('input#phone').fill('+1-555-0200');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect.poll(() => patchedPhone).toEqual({
      mobilePhone: '+1-555-0200',
    });
    await expect(
      page.getByRole('heading', { name: 'Changes Saved' }),
    ).toBeVisible();
    expect(profileApiPatches).toBe(1);
    expect(directGraphPatches).toBe(0);
  });

  test('clears a guest phone through the profile API', async ({
    page,
  }) => {
    const profile = makeGraphProfile({
      userType: 'Guest',
      isAttorney: false,
      extension_example_IsAttorney: false,
    });
    let appPhoneUpdate: unknown = null;
    let directGraphPatches = 0;

    await page.route(graphMeApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profile),
      }),
    );
    await page.route(profileApi, async (route) => {
      if (route.request().method() === 'PATCH') {
        appPhoneUpdate = JSON.parse(route.request().postData() ?? '{}');
        await route.fulfill({ status: 204, body: '' });
        return;
      }
      await route.continue();
    });
    await page.route(graphOwnProfileApi, async (route) => {
      directGraphPatches += 1;
      await route.abort();
    });

    await page.goto('/profile');
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.locator('input#phone').fill('');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(
      page.getByRole('heading', { name: 'Changes Saved' }),
    ).toBeVisible();
    expect(appPhoneUpdate).toEqual({ mobilePhone: null });
    expect(directGraphPatches).toBe(0);
  });

  test('keeps the phone editable when the profile API rejects the update', async ({
    page,
  }) => {
    const profile = makeGraphProfile({
      isAttorney: false,
      extension_example_IsAttorney: false,
    });
    let appPhoneUpdate: unknown = null;

    await page.route(graphMeApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profile),
      }),
    );
    await page.route(profileApi, async (route) => {
      if (route.request().method() === 'PATCH') {
        appPhoneUpdate = JSON.parse(route.request().postData() ?? '{}');
        await route.fulfill({ status: 403, body: 'Forbidden' });
        return;
      }
      await route.continue();
    });

    await page.goto('/profile');
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.locator('input#phone').fill('+1-555-0350');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(
      page.getByRole('heading', { name: 'Save Failed' }),
    ).toBeVisible();
    await expect(page.locator('input#phone')).toHaveValue('+1-555-0350');
    expect(appPhoneUpdate).toEqual({ mobilePhone: '+1-555-0350' });
  });

  test('keeps a saved phone change when another profile field is rejected', async ({
    page,
  }) => {
    const profile = makeGraphProfile({
      isAttorney: false,
      extension_example_IsAttorney: false,
    });
    let phoneUpdates = 0;
    const profilePatches: Record<string, unknown>[] = [];

    await page.route(graphMeApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profile),
      }),
    );
    await page.route(profileApi, async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = JSON.parse(
          route.request().postData() ?? '{}',
        ) as Record<string, unknown>;
        if (Object.hasOwn(body, 'mobilePhone')) {
          phoneUpdates += 1;
          await route.fulfill({ status: 204, body: '' });
          return;
        }
        profilePatches.push(body);
        await route.fulfill({
          status: profilePatches.length === 1 ? 403 : 204,
          body: profilePatches.length === 1 ? 'Forbidden' : '',
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/profile');
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.locator('input#firstName').fill('Janet');
    await page.locator('input#phone').fill('+1-555-0400');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(
      page.getByRole('heading', { name: 'Partially Saved' }),
    ).toBeVisible();
    await expect(
      page.getByText(/Some changes were saved/),
    ).toBeVisible();
    expect(phoneUpdates).toBe(1);
    expect(profilePatches).toEqual([{ givenName: 'Janet' }]);

    await page.getByRole('button', { name: 'OK' }).click();
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(
      page.getByRole('heading', { name: 'Changes Saved' }),
    ).toBeVisible();
    expect(phoneUpdates).toBe(1);
    expect(profilePatches).toEqual([
      { givenName: 'Janet' },
      { givenName: 'Janet' },
    ]);
  });

  test('retains populated values when entering edit mode', async ({ page }) => {
    const profile = makeGraphProfile();

    await page.route(graphMeApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profile),
      }),
    );

    await page.route(graphPhotoApi, (route) =>
      route.fulfill({
        status: 404,
        body: '',
      }),
    );

    await page.goto('/profile');

    await expect(page.locator('input#firstName')).toHaveValue('Jane');
    await expect(page.locator('input#lastName')).toHaveValue('Doe');
    await expect(page.locator('input#phone')).toHaveValue('+1-555-0100');
    await expect(page.locator('input#streetAddress')).toHaveValue(
      '123 Main St',
    );
    await expect(page.locator('input#city')).toHaveValue('Chicago');
    await expect(page.locator('input#state')).toHaveValue('IL');
    await expect(page.locator('input#postalCode')).toHaveValue('60601');
    await expect(page.locator('input#country')).toHaveValue('USA');

    await page.getByRole('button', { name: 'Edit' }).click();

    await expect(page.locator('input#firstName')).toHaveValue('Jane');
    await expect(page.locator('input#lastName')).toHaveValue('Doe');
    await expect(page.locator('input#phone')).toHaveValue('+1-555-0100');
    await expect(page.locator('input#streetAddress')).toHaveValue(
      '123 Main St',
    );
    await expect(page.locator('input#city')).toHaveValue('Chicago');
    await expect(page.locator('input#state')).toHaveValue('IL');
    await expect(page.locator('input#postalCode')).toHaveValue('60601');
    await expect(page.locator('input#country')).toHaveValue('USA');
    await expect(page.locator('input#isAttorney')).toBeChecked();
  });

  test('shows bar admissions when a non-attorney enables attorney editing', async ({
    page,
  }) => {
    const profile = makeGraphProfile({
      isAttorney: false,
      extension_example_IsAttorney: false,
    });

    await page.route(graphMeApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profile),
      }),
    );

    await page.route(graphPhotoApi, (route) =>
      route.fulfill({
        status: 404,
        body: '',
      }),
    );

    await page.goto('/profile');
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('input#isAttorney')).not.toBeChecked();

    await page.locator('input#isAttorney').check();

    await expect(
      page.getByRole('heading', { name: 'Bar Admissions' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Add admission' }),
    ).toBeVisible();
  });

  test('blocks editing when bar admissions fail to load', async ({ page }) => {
    const profile = makeGraphProfile();
    let admissionsGetRequests = 0;
    let admissionsPutRequests = 0;

    await page.unroute(barAdmissionsApi);
    await page.route(barAdmissionsApi, async (route) => {
      if (route.request().method() === 'GET') {
        admissionsGetRequests += 1;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Failed to load bar admissions' }),
        });
        return;
      }

      if (route.request().method() === 'PUT') {
        admissionsPutRequests += 1;
        await route.fulfill({ status: 204, body: '' });
        return;
      }

      await route.continue();
    });

    await page.route(graphMeApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profile),
      }),
    );

    await page.route(graphPhotoApi, (route) =>
      route.fulfill({
        status: 404,
        body: '',
      }),
    );

    await page.goto('/profile');

    await expect(
      page.getByRole('heading', { name: 'User Profile' }),
    ).toBeVisible();
    await expect.poll(() => admissionsGetRequests).toBe(1);
    await expect(page.getByRole('button', { name: 'Edit' })).toBeDisabled();
    await expect(page.getByRole('status')).toHaveText(
      'Bar admissions could not be loaded. Editing is unavailable until the existing admissions are loaded successfully.',
    );
    await expect.poll(() => admissionsPutRequests).toBe(0);
  });

  test('uploads profile photo and refreshes displayed image', async ({
    page,
  }) => {
    const profile = makeGraphProfile();
    let profilePhotoRequests = 0;
    let uploadRequests = 0;

    await page.route(graphMeApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profile),
      }),
    );

    await page.route(graphPhotoApi, async (route) => {
      profilePhotoRequests += 1;
      if (profilePhotoRequests === 1) {
        await route.fulfill({ status: 404, body: '' });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: onePixelPng,
      });
    });

    await page.route(profilePhotoApi, async (route) => {
      if (route.request().method() === 'POST') {
        uploadRequests += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ updated: true }),
        });
        return;
      }

      await route.continue();
    });

    await page.goto('/profile');

    await expect(page.locator('input#firstName')).toHaveValue('Jane');
    await expect(page.locator('input[type="file"]')).toHaveCount(1);

    await page.locator('input[type="file"]').setInputFiles({
      name: 'profile.png',
      mimeType: 'image/png',
      buffer: onePixelPng,
    });

    await expect.poll(() => uploadRequests).toBe(1);
    await expect.poll(() => profilePhotoRequests).toBeGreaterThan(1);
    await expect(page.getByAltText('Profile Photo')).toBeVisible();
  });

  test('retries account enable after transient failure', async ({ page }) => {
    const profile = makeGraphProfile();
    let enableRequests = 0;

    await page.unroute(enableAccountsApi);
    await page.route(enableAccountsApi, async (route) => {
      enableRequests += 1;
      if (enableRequests === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'temporary failure' }),
        });
        return;
      }

      await route.fulfill({
        status: 204,
        body: '',
      });
    });

    await page.route(graphMeApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profile),
      }),
    );

    await page.route(graphPhotoApi, (route) =>
      route.fulfill({
        status: 404,
        body: '',
      }),
    );

    await page.goto('/profile');
    await expect(
      page.getByRole('heading', { name: 'User Profile' }),
    ).toBeVisible();
    await expect.poll(() => enableRequests).toBe(1);

    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'User Profile' }),
    ).toBeVisible();
    await expect.poll(() => enableRequests).toBe(2);
  });
});
