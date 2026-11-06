import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { installMockAuthRuntimeDependencies } from './fixtures/auth';

const notificationsCountApi = '**/api/accounts/notifications/count**';
const negotiateApi = '**/api/realtime/negotiate';
const userAccessApi = '**/api/accounts/access**';
const initializeAccountApi = '**/api/accounts/initialize**';
const enableAccountsApi = '**/api/accounts/cases/enable**';
const graphMeApi = 'https://graph.microsoft.com/beta/me';
const graphPhotoApi = 'https://graph.microsoft.com/beta/me/photo/$value';

const caseId = '00000000-0000-4000-8000-000000001030';
const requestId = '00000000-0000-4000-8000-000000001031';
const accountId = '00000000-0000-4000-8000-000000001032';
const userOid = '00000000-0000-4000-8000-000000001033';

function makeGraphProfile() {
  return {
    id: userOid,
    accountEnabled: true,
    createdDateTime: '2026-01-01T00:00:00.000Z',
    displayName: 'E2E User',
    givenName: 'E2E',
    surname: 'User',
    isLicenseReconciliationNeeded: false,
    mail: 'e2e.user@example.com',
    mailNickname: 'e2euser',
    refreshTokensValidFromDateTime: '2026-01-01T00:00:00.000Z',
    securityIdentifier: 'S-1-5-21-1234567890-123456789-123456789-7300',
    signInSessionsValidFromDateTime: '2026-01-01T00:00:00.000Z',
    userType: 'Member',
    userPrincipalName: 'e2e.user@example.com',
    extension_example_IsAttorney: true,
  };
}

function makeCaseDetailsResponse() {
  return {
    id: '00000000-0000-4000-8000-000000001034',
    accountId,
    emailAddresses: ['e2e.user@example.com'],
    oids: [userOid],
    agreedToTerms: true,
    isActive: true,
    casesAccounts: [
      {
        accountId: caseId,
        caseNumber: 'CN-E2E-DARK-ARGUMENT',
        agreedToCaseTerms: true,
        isGuest: false,
        canUseQA: true,
        canGenerateDeclaration: true,
        canAccessDocuments: true,
      },
    ],
  };
}

function makeArgumentBuilderRequest() {
  return {
    id: requestId,
    accountId: caseId,
    sessionId: '00000000-0000-4000-8000-000000001035',
    input: 'Prepare a dark-mode argument viewer test.',
    type: 'argument-builder',
    status: 'completed',
    oid: userOid,
    startedAt: '2026-06-17T00:00:00.000Z',
    endedAt: '2026-06-17T00:01:00.000Z',
    contents: [],
    sourceUrl: null,
    rawOutputJson: null,
    output: {
      initialArgument:
        'The first draft argument cites the notice. [1](#1)\n\n- The client received notice.',
      counterArgument:
        'The anticipated counter argument is visible in dark mode.',
      finalArgument:
        'Final argument is supported by the notice and remains readable.',
      context: [
        {
          docId: 'notice-document',
          title: 'Notice.pdf',
          sourceUrl:
            'https://sharepoint.example.test/sites/' +
            caseId +
            '/Shared%20Documents/Evidence/Notice.pdf',
          headers: ['Notice Header'],
          pages: [1],
          tags: ['fact'],
          who: 'Client A',
          what: 'Received notice',
          where: 'County courthouse',
          why: 'Service was completed',
          whenStarted: { year: '2026', month: 'June', day: '17' },
        },
      ],
      validationStatus: [
        {
          claim: 'Notice was received.',
          explanation:
            'Evidence confirms **notice** in the supporting material.',
          isValid: true,
          isInferred: true,
          sources: [{ docId: 'notice-document', pages: [1] }],
        },
      ],
    },
  };
}

async function installCommonRoutes(page: Page) {
  await installMockAuthRuntimeDependencies(page);

  await page.route(graphMeApi, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeGraphProfile()),
    }),
  );

  await page.route(graphPhotoApi, (route) =>
    route.fulfill({ status: 404, body: '' }),
  );

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
    route.fulfill({ status: 204, body: '' }),
  );

  await page.route('**/api/accounts/cases/' + caseId, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeCaseDetailsResponse()),
    }),
  );

  await page.route(
    '**/api/accounts/cases/' + caseId + '/requests/' + requestId,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeArgumentBuilderRequest()),
      }),
  );
}

async function gotoArgumentViewer(page: Page) {
  const targetPath = '/cases/' + caseId + '/argument-builder/' + requestId;

  try {
    await page.goto(targetPath, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    return;
  } catch (error) {
    if (!String(error).includes('ERR_ABORTED')) {
      throw error;
    }
  }

  await page.waitForTimeout(750);
  await page.goto(targetPath, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
}

async function expectNoColorContrastViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .include('[data-testid="argument-viewer-content"]')
    .withRules(['color-contrast'])
    .analyze();

  expect(
    results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        html: node.html,
        failureSummary: node.failureSummary,
      })),
    })),
  ).toEqual([]);
}

test('argument viewer generated content stays readable in dark theme @a11y', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ colorScheme: 'dark' });
  await installCommonRoutes(page);

  await gotoArgumentViewer(page);

  await expect(page.getByRole('note', { name: 'AI output warning' })).toHaveText(
    'AI-generated. May be inaccurate. Verify before relying on outputs.',
  );

  await expect(
    page.getByRole('heading', { name: 'Argument Viewer' }),
  ).toBeVisible();

  await page
    .locator('summary')
    .filter({ hasText: /^First Draft Argument$/ })
    .click();
  await expect(
    page.getByText('The first draft argument cites the notice.'),
  ).toBeVisible();

  await expect(
    page.getByText(
      'Final argument is supported by the notice and remains readable.',
    ),
  ).toBeVisible();

  await page
    .locator('summary')
    .filter({ hasText: /^Supporting Materials$/ })
    .click();
  await page
    .locator('summary')
    .filter({ hasText: 'Supporting Material 1: Notice.pdf' })
    .last()
    .click();
  await expect(
    page.getByRole('cell', { name: 'Client A' }).last(),
  ).toBeVisible();

  await page
    .locator('summary')
    .filter({ hasText: 'Validation Report' })
    .last()
    .click();
  await expect(page.getByText('Evidence confirms notice').last()).toBeVisible();

  await expectNoColorContrastViolations(page);
});
