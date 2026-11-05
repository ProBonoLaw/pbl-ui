import { expect, type Page, test } from '@playwright/test';
import { installMockAuthRuntimeDependencies } from './fixtures/auth';

const caseId = '00000000-0000-4000-8000-000000001092';
const caseApi = '**/api/accounts/cases/' + caseId;
const casesListApi = '**/api/accounts/cases';
const termsApi = '**/api/accounts/terms**';
const notificationsCountApi = '**/api/accounts/notifications/count**';
const negotiateApi = '**/api/realtime/negotiate';
const userAccessApi = '**/api/accounts/access**';
const initializeAccountApi = '**/api/accounts/initialize**';
const enableAccountsApi = '**/api/accounts/cases/enable**';
const graphMeApi = 'https://graph.microsoft.com/beta/me';
const graphPhotoApi = 'https://graph.microsoft.com/beta/me/photo/$value';

function makeGraphProfile() {
  return {
    id: '00000000-0000-4000-8000-000000001093',
    accountEnabled: true,
    createdDateTime: '2026-01-01T00:00:00.000Z',
    displayName: 'Terms User',
    givenName: 'Terms',
    surname: 'User',
    isLicenseReconciliationNeeded: false,
    mail: 'terms.user@example.com',
    mailNickname: 'termsuser',
    refreshTokensValidFromDateTime: '2026-01-01T00:00:00.000Z',
    securityIdentifier: 'S-1-5-21-1234567890-123456789-123456789-9300',
    signInSessionsValidFromDateTime: '2026-01-01T00:00:00.000Z',
    userType: 'Member',
    userPrincipalName: 'terms.user@example.com',
    mobilePhone: '+1-555-0193',
    extension_example_IsAttorney: true,
    isAttorney: true,
  };
}

function makeCaseResponse(
  agreedToCaseTerms?: boolean,
  overrides: Record<string, unknown> = {},
) {
  const caseAccount: Record<string, unknown> = {
    accountId: caseId,
    caseNumber: 'DEMO-TERMS-1',
    billingCode: 'D',
    isGuest: false,
    canGenerateDeclaration: true,
    canUseQA: true,
    canAccessDocuments: true,
    record: {
      id: caseId,
      accountId: caseId,
      type: 'ACCOUNT_DETAILS',
      caseNumber: 'DEMO-TERMS-1',
      personInformation: {
        firstName: 'Taylor',
        lastName: 'Client',
        emailAddress: 'client@example.com',
        phoneNumber: '+1-555-0100',
      },
      filingRole: 'Plaintiff',
      state: 'OK',
      county: 'Tulsa',
      description: 'Demo terms matter',
      currentAttorney: {
        firstName: 'Case',
        lastName: 'Attorney',
        firmName: 'PB Law',
        emailAddress: 'attorney@example.com',
        phoneNumber: '+1-555-0101',
        isCurrent: true,
      },
      opposition: {
        firstName: 'Opposing',
        lastName: 'Party',
        filingRole: 'Defendant',
        emailAddress: 'opposing@example.com',
        phoneNumber: '+1-555-0102',
        currentAttorney: {
          firstName: 'Opposing',
          lastName: 'Attorney',
          firmName: 'Opposing Firm',
          emailAddress: 'opp-attorney@example.com',
          phoneNumber: '+1-555-0103',
          isCurrent: true,
        },
      },
    },
  };

  Object.assign(caseAccount, overrides);

  if (agreedToCaseTerms !== undefined) {
    caseAccount.agreedToCaseTerms = agreedToCaseTerms;
  }

  return {
    id: '00000000-0000-4000-8000-000000001094',
    emailAddresses: ['terms.user@example.com'],
    oids: ['00000000-0000-4000-8000-000000001095'],
    accountId: '00000000-0000-4000-8000-000000001096',
    agreedToTerms: true,
    isActive: true,
    casesAccounts: [caseAccount],
  };
}

async function installCaseTermsRoutes(page: Page) {
  await installMockAuthRuntimeDependencies(page);

  await page.route(graphMeApi, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeGraphProfile()),
    }),
  );
  await page.route(graphPhotoApi, (route) => route.fulfill({ status: 404 }));
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
      body: JSON.stringify({ url: 'wss://example.com/e2e' }),
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
    route.fulfill({ status: 204, body: '' }),
  );
  await page.route(casesListApi, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([makeCaseResponse(true)]),
    }),
  );

  let hasAcceptedTerms: boolean | undefined;
  let capturedTermsBody: Record<string, unknown> | null = null;
  let termsPostCount = 0;
  let caseGetCount = 0;
  await page.route(caseApi, (route) => {
    caseGetCount += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeCaseResponse(hasAcceptedTerms)),
    });
  });
  await page.route(termsApi, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          title: 'Cloud Services Evaluation Agreement',
          effectiveDate: 'May 22, 2026',
          markdown:
            'This demo agreement is loaded from the case billing-code markdown file.',
          acknowledgement:
            'I have read and agree to the demo case terms of service for this matter.',
        }),
      });
      return;
    }

    termsPostCount += 1;
    capturedTermsBody = route.request().postDataJSON() as Record<
      string,
      unknown
    >;
    hasAcceptedTerms = true;
    await route.fulfill({ status: 204, body: '' });
  });

  return {
    getCapturedTermsBody: () => capturedTermsBody,
    getTermsPostCount: () => termsPostCount,
    getCaseGetCount: () => caseGetCount,
  };
}

test('case page requires accepting demo case terms before showing operations', async ({
  page,
}) => {
  const terms = await installCaseTermsRoutes(page);

  await page.goto('/cases/' + caseId);

  await expect(
    page.getByRole('heading', { name: 'Cloud Services Evaluation Agreement' }),
  ).toBeVisible();
  await expect.poll(() => terms.getCaseGetCount()).toBe(1);
  await expect(page.getByRole('heading', { name: 'Case Details' })).toHaveCount(
    0,
  );
  await expect(
    page
      .locator('nav[aria-label="Case navigation"]')
      .getByRole('link', { name: 'Details' }),
  ).toHaveCount(0);

  await page
    .getByLabel(/I have read and agree to the demo case terms/i)
    .check();
  await page.getByRole('button', { name: 'Agree' }).click();

  await expect(
    page.getByRole('heading', { name: 'Cloud Services Evaluation Agreement' }),
  ).toHaveCount(0);
  await expect.poll(() => terms.getCapturedTermsBody()?.scope).toBe('case');
  await expect.poll(() => terms.getCapturedTermsBody()?.caseId).toBe(caseId);
  await expect.poll(() => terms.getCapturedTermsBody()?.termsType).toBe('demo');
  await expect.poll(() => terms.getCaseGetCount()).toBeGreaterThan(1);
  await expect(
    page
      .locator('nav[aria-label="Case navigation"]')
      .getByRole('link', { name: 'Details' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Case' })).toBeVisible();
});

test('declining case terms navigates to the case explorer without accepting', async ({
  page,
}) => {
  const terms = await installCaseTermsRoutes(page);

  await page.goto('/cases/' + caseId);

  await expect(
    page.getByRole('heading', { name: 'Cloud Services Evaluation Agreement' }),
  ).toBeVisible();

  await Promise.all([
    page.waitForURL(/\/cases$/),
    page.getByRole('button', { name: 'Decline' }).click(),
  ]);

  await expect.poll(() => terms.getTermsPostCount()).toBe(0);
});

test('guest shared-resource demo cases use demo terms from resolved terms billing code', async ({
  page,
}) => {
  await installMockAuthRuntimeDependencies(page);

  await page.route(graphMeApi, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeGraphProfile()),
    }),
  );
  await page.route(graphPhotoApi, (route) => route.fulfill({ status: 404 }));
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
      body: JSON.stringify({ url: 'wss://example.com/e2e' }),
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
    route.fulfill({ status: 204, body: '' }),
  );
  await page.route(caseApi, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        makeCaseResponse(undefined, {
          billingCode: undefined,
          isGuest: true,
          termsBillingCode: 'D',
        }),
      ),
    }),
  );

  let requestedTermsType: string | null = null;
  await page.route(termsApi, async (route) => {
    const requestUrl = new URL(route.request().url());
    requestedTermsType = requestUrl.searchParams.get('termsType');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        title: 'Cloud Services Evaluation Agreement',
        effectiveDate: 'May 22, 2026',
        markdown: 'Shared resource demo agreement.',
        acknowledgement:
          'I have read and agree to the demo case terms of service for this matter.',
      }),
    });
  });

  await page.goto('/cases/' + caseId);

  await expect(
    page.getByRole('heading', { name: 'Cloud Services Evaluation Agreement' }),
  ).toBeVisible();
  await expect.poll(() => requestedTermsType).toBe('demo');
});
