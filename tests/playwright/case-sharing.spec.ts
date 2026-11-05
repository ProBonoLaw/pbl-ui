import { expect, test, type Page } from '@playwright/test';
import { installMockAuthRuntimeDependencies } from './fixtures/auth';

const notificationsCountApi = '**/api/accounts/notifications/count**';
const negotiateApi = '**/api/realtime/negotiate';
const userAccessApi = '**/api/accounts/access**';
const initializeAccountApi = '**/api/accounts/initialize**';
const enableAccountsApi = '**/api/accounts/cases/enable**';
const graphMeApi = 'https://graph.microsoft.com/beta/me';
const graphPhotoApi = 'https://graph.microsoft.com/beta/me/photo/$value';

const CASE_ID = '00000000-0000-4000-8000-000000001071';
const ACCOUNT_ID = '00000000-0000-4000-8000-000000001082';
const OWNER_OID = '00000000-0000-4000-8000-000000001100';
const GUEST_OID = '00000000-0000-4000-8000-000000001101';

function makeGraphProfile() {
  return {
    id: OWNER_OID,
    accountEnabled: true,
    createdDateTime: '2026-01-01T00:00:00.000Z',
    displayName: 'Case Owner',
    givenName: 'Case',
    surname: 'Owner',
    isLicenseReconciliationNeeded: false,
    mail: 'owner.case@example.com',
    mailNickname: 'caseowner',
    refreshTokensValidFromDateTime: '2026-01-01T00:00:00.000Z',
    securityIdentifier: 'S-1-5-21-1234567890-123456789-123456789-5678',
    signInSessionsValidFromDateTime: '2026-01-01T00:00:00.000Z',
    userType: 'Member',
    userPrincipalName: 'owner.case@example.com',
    extension_example_IsAttorney: true,
  };
}

async function installCommonRoutes(page: Page) {
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

  await page.route(graphMeApi, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeGraphProfile()),
    }),
  );

  await page.route(graphPhotoApi, (route) =>
    route.fulfill({
      status: 404,
      body: '',
    }),
  );

  await page.route('**/api/accounts/cases/' + CASE_ID, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accountId: ACCOUNT_ID,
        emailAddresses: ['owner.case@example.com'],
        oids: [OWNER_OID],
        agreedToTerms: true,
        isActive: true,
        casesAccounts: [
          {
            accountId: CASE_ID,
            caseNumber: 'CASE-777',
            agreedToCaseTerms: true,
            isGuest: false,
            canUseQA: true,
            canGenerateDeclaration: true,
            canAccessDocuments: true,
          },
        ],
      }),
    }),
  );

  await page.route('**/api/accounts/cases/' + CASE_ID + '/users', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          accountId: ACCOUNT_ID,
          emailAddresses: ['owner.case@example.com'],
          oids: [OWNER_OID],
          agreedToTerms: true,
          isActive: true,
          casesAccounts: [
            {
              accountId: CASE_ID,
              caseNumber: 'CASE-777',
              agreedToCaseTerms: true,
              isGuest: false,
              canUseQA: true,
              canGenerateDeclaration: true,
              canAccessDocuments: true,
            },
          ],
        },
        {
          accountId: ACCOUNT_ID,
          emailAddresses: ['guest.case@example.com'],
          oids: [GUEST_OID],
          agreedToTerms: true,
          isActive: true,
          casesAccounts: [
            {
              accountId: CASE_ID,
              caseNumber: 'CASE-777',
              agreedToCaseTerms: true,
              isGuest: true,
              canUseQA: true,
              canGenerateDeclaration: false,
              canAccessDocuments: true,
              documentAccessRole: 'VIEW-ONLY',
            },
          ],
        },
      ]),
    }),
  );
}

test('case sharing offers access editing for guests but not the owner account', async ({
  page,
}) => {
  await installCommonRoutes(page);

  await page.goto('/cases/' + CASE_ID + '/share');

  const ownerRow = page.getByRole('listitem').filter({ hasText: 'owner.case@example.com' });
  await expect(ownerRow).toBeVisible();
  await expect(ownerRow.getByRole('button', { name: /Options for/ })).toHaveCount(0);

  const guestRow = page.getByRole('listitem').filter({ hasText: 'guest.case@example.com' });
  await expect(guestRow).toBeVisible();
  await guestRow.getByRole('button', { name: /Options for/ }).click();
  const guestEditLink = page.getByRole('menuitem', { name: 'Edit access' });
  await expect(guestEditLink).toBeVisible();
  await expect(guestEditLink).toHaveAttribute(
    'href',
    './share/' + GUEST_OID + '/edit',
  );
});

async function captureCaseUsersPost(page: Page) {
  let capturedRequest: unknown = null;

  await page.route(
    '**/api/accounts/cases/' + CASE_ID + '/users',
    async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }

      capturedRequest = route.request().postDataJSON();
      await route.fulfill({
        status: 204,
        body: '',
      });
    },
  );

  return () => capturedRequest;
}

async function captureSharedUserEditPost(page: Page) {
  let capturedRequest: unknown = null;
  let resolveUserLoaded: () => void = () => {};
  const userLoaded = new Promise<void>((resolve) => {
    resolveUserLoaded = resolve;
  });

  await page.route(
    '**/api/accounts/cases/' + CASE_ID + '/users/' + GUEST_OID,
    async (route) => {
      if (route.request().method() === 'POST') {
        capturedRequest = route.request().postDataJSON();
        await route.fulfill({
          status: 204,
          body: '',
        });
        return;
      }

      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accountId: ACCOUNT_ID,
            emailAddresses: ['guest.case@example.com'],
            oids: [GUEST_OID],
            agreedToTerms: true,
            isActive: true,
            casesAccounts: [
              {
                accountId: CASE_ID,
                caseNumber: 'CASE-777',
                agreedToCaseTerms: true,
                isGuest: true,
                canUseQA: true,
                canGenerateDeclaration: false,
                canAccessDocuments: true,
                documentAccessRole: 'CONTRIBUTOR',
              },
            ],
          }),
        });
        resolveUserLoaded();
        return;
      }

      await route.fallback();
    },
  );

  return {
    getCapturedRequest: () => capturedRequest,
    waitForUserLoaded: () => userLoaded,
  };
}

test('case sharing shows document access role labels in the user list', async ({
  page,
}) => {
  await installCommonRoutes(page);

  await page.goto('/cases/' + CASE_ID + '/share');

  const ownerRow = page.getByRole('listitem').filter({ hasText: 'owner.case@example.com' });
  await expect(ownerRow).toContainText('Administrator');

  const guestRow = page.getByRole('listitem').filter({ hasText: 'guest.case@example.com' });
  await expect(guestRow).toContainText('Viewer');
});

test('case sharing add form is aligned beside the case navigation', async ({
  page,
}) => {
  await installCommonRoutes(page);

  await page.goto('/cases/' + CASE_ID + '/share');

  const sharingHeading = page.getByRole('heading', {
    name: 'Case Sharing',
  });
  await expect(sharingHeading).toBeVisible();
  const sharingHeadingBox = await sharingHeading.boundingBox();

  await page.getByRole('link', { name: 'Add User' }).click();
  await expect(page).toHaveURL('/cases/' + CASE_ID + '/share/add');

  const addHeading = page.getByRole('heading', { name: 'Add Case Sharing' });
  const caseNavigation = page.getByRole('navigation', {
    name: 'Case navigation',
  });
  const addForm = page.locator('form');
  await expect(addHeading).toBeVisible();
  await expect(addForm).toBeVisible();

  const [addHeadingBox, caseNavigationBox, addFormBox] = await Promise.all([
    addHeading.boundingBox(),
    caseNavigation.boundingBox(),
    addForm.boundingBox(),
  ]);

  expect(sharingHeadingBox).not.toBeNull();
  expect(addHeadingBox).not.toBeNull();
  expect(caseNavigationBox).not.toBeNull();
  expect(addFormBox).not.toBeNull();
  expect(Math.abs(addHeadingBox!.x - sharingHeadingBox!.x)).toBeLessThan(0.5);
  expect(addFormBox!.x).toBeGreaterThanOrEqual(
    caseNavigationBox!.x + caseNavigationBox!.width - 1,
  );
});

test('case sharing add form submits Viewer document access role', async ({
  page,
}) => {
  await installCommonRoutes(page);
  const getCapturedRequest = await captureCaseUsersPost(page);

  await page.goto('/cases/' + CASE_ID + '/share/add');

  await page.getByLabel('Email Address').fill('viewer.case@example.com');

  const accessDocuments = page.getByRole('checkbox', {
    name: 'Access Documents',
  });
  const contributorRole = page.getByRole('radio', { name: /Contributor/ });
  const viewerRole = page.getByRole('radio', { name: /Viewer/ });

  await expect(accessDocuments).not.toBeChecked();
  await expect(contributorRole).toBeDisabled();
  await expect(viewerRole).toBeDisabled();

  await accessDocuments.check();
  await expect(contributorRole).toBeEnabled();
  await expect(viewerRole).toBeEnabled();
  await viewerRole.check();

  await page.getByRole('button', { name: 'Add Shared User' }).click();

  expect(getCapturedRequest()).toEqual({
    guests: [
      {
        emailAddress: 'viewer.case@example.com',
        canUseQA: false,
        canGenerateDeclaration: false,
        canAccessDocuments: true,
        documentAccessRole: 'VIEW-ONLY',
      },
    ],
  });
});

test('case sharing edit form omits document role when Access Documents is unchecked', async ({
  page,
}) => {
  await installCommonRoutes(page);
  const { getCapturedRequest, waitForUserLoaded } =
    await captureSharedUserEditPost(page);

  await Promise.all([
    waitForUserLoaded(),
    page.goto('/cases/' + CASE_ID + '/share/' + GUEST_OID + '/edit'),
  ]);

  await expect(page.locator('#emailAddress')).toHaveValue(
    'guest.case@example.com',
  );

  const accessDocuments = page.getByRole('checkbox', {
    name: 'Access Documents',
  });
  const contributorRole = page.getByRole('radio', { name: /Contributor/ });
  const viewerRole = page.getByRole('radio', { name: /Viewer/ });

  await expect(accessDocuments).toBeChecked();
  await expect(contributorRole).toBeChecked();
  await expect(viewerRole).toBeEnabled();

  await accessDocuments.uncheck();
  await expect(contributorRole).toBeDisabled();
  await expect(viewerRole).toBeDisabled();

  await page.getByRole('button', { name: 'Save' }).click();

  expect(getCapturedRequest()).toEqual({
    emailAddress: 'guest.case@example.com',
    canUseQA: true,
    canGenerateDeclaration: false,
    canAccessDocuments: false,
  });
});
