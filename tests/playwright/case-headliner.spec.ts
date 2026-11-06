import { expect, test, type Page } from '@playwright/test';
import { installMockAuthRuntimeDependencies } from './fixtures/auth';

const notificationsCountApi = '**/api/accounts/notifications/count**';
const negotiateApi = '**/api/realtime/negotiate';
const userAccessApi = '**/api/accounts/access**';
const initializeAccountApi = '**/api/accounts/initialize**';
const enableAccountsApi = '**/api/accounts/cases/enable**';

const CASE_ID = '00000000-0000-4000-8000-000000001000';
const ACCOUNT_ID = '00000000-0000-4000-8000-000000001001';
const OWNER_OID = '00000000-0000-4000-8000-000000001004';

function makeCaseGroup({
  nickname,
  caseNumber,
  personFirstName,
  personLastName,
  personOrganization,
  oppositionFirstName,
  oppositionLastName,
  oppositionOrganization,
  filingRole,
}: {
  nickname?: string;
  caseNumber: string;
  personFirstName: string;
  personLastName: string;
  personOrganization: string;
  oppositionFirstName: string;
  oppositionLastName: string;
  oppositionOrganization: string;
  filingRole: string;
}) {
  return {
    id: CASE_ID,
    accountId: ACCOUNT_ID,
    emailAddresses: ['e2e.user@example.com'],
    oids: [OWNER_OID],
    agreedToTerms: true,
    isActive: true,
    casesAccounts: [
      {
        accountId: ACCOUNT_ID,
        caseNumber,
        agreedToCaseTerms: true,
        isGuest: false,
        canUseQA: true,
        canGenerateDeclaration: true,
        canAccessDocuments: true,
        record: {
          id: CASE_ID,
          accountId: ACCOUNT_ID,
          type: 'ACCOUNT_DETAILS',
          caseNumber,
          filingRole,
          extendedControls: { verbosity: true, swapRoles: true },
          state: 'WA',
          county: 'King',
          description: 'E2E test case',
          nickname,
          personInformation: {
            firstName: personFirstName,
            lastName: personLastName,
            organization: personOrganization,
            emailAddress: '',
            phoneNumber: '',
          },
          opposition: {
            firstName: oppositionFirstName,
            lastName: oppositionLastName,
            organization: oppositionOrganization,
            filingRole: 'Defendant',
            emailAddress: '',
            phoneNumber: '',
          },
        },
      },
    ],
  };
}

async function installCommonRoutes(page: Page, caseResponse: unknown) {
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

  await page.route('**/api/accounts/cases/' + CASE_ID, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(caseResponse),
    }),
  );
}

test.describe('CaseHeadliner', () => {
  test('prefers nickname on QA page', async ({ page }) => {
    await installCommonRoutes(
      page,
      makeCaseGroup({
        nickname: 'Project Sunrise',
        caseNumber: 'CN-001',
        personFirstName: 'Jane',
        personLastName: 'Doe',
        personOrganization: '',
        oppositionFirstName: 'John',
        oppositionLastName: 'Smith',
        oppositionOrganization: '',
        filingRole: 'Plaintiff',
      }),
    );

    await page.goto('/cases/' + CASE_ID + '/qa');

    await expect(
      page
        .locator('[data-slot="case-page-actions"]')
        .getByRole('note', { name: 'AI output warning' }),
    ).toHaveText('AI-generated. May be inaccurate. Verify before relying on outputs.');

    await expect(
      page.getByText('Project Sunrise', { exact: true }).last(),
    ).toBeVisible();
    await expect(page.getByText('Project Sunrise (CN-001)')).toHaveCount(0);
  });

  test('uses generated title with organization fallback and case number when nickname is missing', async ({
    page,
  }) => {
    await installCommonRoutes(
      page,
      makeCaseGroup({
        caseNumber: 'CN-002',
        personFirstName: '',
        personLastName: ' ',
        personOrganization: 'Alpha Org',
        oppositionFirstName: ' ',
        oppositionLastName: '',
        oppositionOrganization: 'Beta LLC',
        filingRole: 'Plaintiff',
      }),
    );

    await page.goto('/cases/' + CASE_ID + '/qa');

    await expect(
      page.getByText('Alpha Org v. Beta LLC (CN-002)', { exact: true }),
    ).toBeVisible();
  });

  test('shows N/A case number when case number is whitespace only', async ({
    page,
  }) => {
    await installCommonRoutes(
      page,
      makeCaseGroup({
        caseNumber: '   ',
        personFirstName: 'Pat',
        personLastName: 'Client',
        personOrganization: '',
        oppositionFirstName: 'Other',
        oppositionLastName: 'Party',
        oppositionOrganization: '',
        filingRole: 'Plaintiff',
      }),
    );

    await page.goto('/cases/' + CASE_ID + '/qa');

    await expect(
      page.getByText('Pat Client v. Other Party (N/A)', { exact: true }),
    ).toBeVisible();
  });
});


test.describe('QA controls', () => {
  const caseGroup = makeCaseGroup({
    nickname: 'Project Sunrise',
    caseNumber: 'CN-001',
    personFirstName: 'Jane',
    personLastName: 'Doe',
    personOrganization: '',
    oppositionFirstName: 'John',
    oppositionLastName: 'Smith',
    oppositionOrganization: '',
    filingRole: 'Plaintiff',
  });

  test('places QA controls in page actions and keeps Submit in the composer', async ({ page }) => {
    await installCommonRoutes(page, caseGroup);
    await page.goto('/cases/' + CASE_ID + '/qa');
    await expect(page.locator('textarea[name="requestText"]')).toBeVisible();

    for (const viewport of [
      { width: 640, height: 956 },
      { width: 768, height: 1024 },
      { width: 900, height: 1024 },
      { width: 1023, height: 1024 },
      { width: 1024, height: 1024 },
      { width: 1279, height: 1024 },
    ]) {
      await page.setViewportSize(viewport);
      const composer = page.locator('[data-slot="qa-composer"]');
      const actions = page.locator('[data-slot="case-page-actions"]');
      const controlsButton = await actions.getByRole('button', { name: 'QA controls' }).boundingBox();
      const submitButton = await composer.getByRole('button', { name: 'Submit' }).boundingBox();
      const composerBox = await composer.boundingBox();
      const actionsBox = await actions.boundingBox();
      expect(controlsButton!.x + controlsButton!.width).toBeLessThanOrEqual(actionsBox!.x + actionsBox!.width);
      await expect(composer.getByRole('button', { name: 'QA controls' })).toHaveCount(0);
      expect(submitButton!.x + submitButton!.width).toBeLessThanOrEqual(composerBox!.x + composerBox!.width);
      expect(await composer.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      expect((await page.locator('[data-slot="qa-chat-viewport"]').boundingBox())!.height).toBeGreaterThanOrEqual(96);
    }
  });

  test('sizes the chat viewport within the mobile page content', async ({ page }) => {
    await installCommonRoutes(page, caseGroup);
    await page.goto('/cases/' + CASE_ID + '/qa');
    await expect(page.locator('textarea[name="requestText"]')).toBeVisible();

    for (const viewport of [
      { width: 320, height: 568 },
      { width: 375, height: 667 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 440, height: 956 },
    ]) {
      await page.setViewportSize(viewport);
      const chat = page.locator('[data-slot="qa-chat-viewport"]');
      const chatBox = await chat.boundingBox();
      const composerBox = await page.locator('form:has(textarea[name="requestText"])').boundingBox();
      const content = page.locator('[data-slot="page-content"]');
      const contentBox = await content.boundingBox();
      expect(chatBox).not.toBeNull();
      expect(composerBox).not.toBeNull();
      expect(contentBox).not.toBeNull();
      expect(chatBox!.height).toBeGreaterThanOrEqual(96);
      expect(chatBox!.y).toBeGreaterThanOrEqual(contentBox!.y);
      expect(composerBox!.y).toBeGreaterThanOrEqual(chatBox!.y + chatBox!.height - 1);
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height);
      expect(composerBox!.y + composerBox!.height).toBeLessThanOrEqual(contentBox!.y + contentBox!.height + 1);
    }

    await page.setViewportSize({ width: 320, height: 568 });
    await page.getByRole('button', { name: 'QA controls', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'QA controls' });
    const panel = drawer.locator('[data-slot="qa-controls-panel"]');
    await expect(panel).toBeVisible();
    await expect.poll(async () => {
      const box = await panel.boundingBox();
      return box ? box.x + box.width : Infinity;
    }).toBeLessThanOrEqual(320);
    const drawerBox = await panel.boundingBox();
    expect(drawerBox!.x).toBeGreaterThanOrEqual(0);
    await drawer.getByRole('button', { name: 'Close QA controls' }).click();
    await expect(panel).toBeHidden();

    for (const viewport of [
      { width: 667, height: 375 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      const content = page.locator('[data-slot="page-content"]');
      const controls = await page.locator('[data-slot="case-page-actions"]').getByRole('button', { name: 'QA controls' }).boundingBox();
      const warning = await page.getByRole('note', { name: 'AI output warning' }).boundingBox();
      const heading = await page.getByText('QA', { exact: true }).first().evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const rect = range.getBoundingClientRect();
        return { x: rect.x, width: rect.width };
      });
      expect(controls!.x + controls!.width).toBeLessThanOrEqual(viewport.width);
      expect(controls!.y + controls!.height).toBeLessThanOrEqual(warning!.y);
      expect(controls!.x).toBeGreaterThanOrEqual(heading!.x + heading!.width);
      expect((await page.locator('[data-slot="qa-chat-viewport"]').boundingBox())!.height).toBeGreaterThanOrEqual(40);
      expect((await page.locator('[data-slot="qa-composer"]').boundingBox())!.height).toBeGreaterThanOrEqual(40);
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height);
      await content.evaluate((element) => element.scrollTo(0, element.scrollHeight));
      const composer = await page.locator('[data-slot="qa-composer"]').boundingBox();
      const contentBox = await content.boundingBox();
      expect(composer!.y + composer!.height).toBeLessThanOrEqual(contentBox!.y + contentBox!.height + 1);
    }
  });

  test('keeps long answers within the chat scrollbar', async ({ page }) => {
    await page.setViewportSize({ width: 440, height: 956 });
    await installCommonRoutes(page, caseGroup);
    await page.route('**/api/accounts/cases/' + CASE_ID + '/qa', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { document: 'Long answer paragraph.\n\n'.repeat(150), exhibits: [] },
        }),
      }),
    );
    await page.goto('/cases/' + CASE_ID + '/qa');
    await page.locator('textarea[name="requestText"]').fill('Summarize this case');
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.getByRole('button', { name: 'QA controls', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'QA controls' }).getByRole('button', { name: 'Export Chat' })).toBeEnabled();
    await page.getByRole('button', { name: 'Close QA controls' }).click();

    for (const viewport of [
      { width: 320, height: 568 },
      { width: 375, height: 667 },
      { width: 390, height: 667 },
      { width: 430, height: 932 },
      { width: 440, height: 956 },
      { width: 667, height: 375 },
      { width: 844, height: 390 },
      { width: 1280, height: 720 },
    ]) {
      await page.setViewportSize(viewport);
      const chat = page.locator('[data-slot="qa-chat-viewport"]');
      const content = page.locator('[data-slot="page-content"]');
      await expect.poll(() => chat.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
      expect(
        await content.evaluate((element) => element.scrollHeight - element.clientHeight),
        `${viewport.width}x${viewport.height}`,
      ).toBeLessThanOrEqual(1);
      expect(
        await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight),
        `${viewport.width}x${viewport.height}`,
      ).toBeLessThanOrEqual(1);
    }
  });

  test('applies verbosity and perspective to a QA request, then resets the chat', async ({ page }) => {
    await installCommonRoutes(page, caseGroup);
    let requestBody: Record<string, unknown> | undefined;
    await page.route('**/api/accounts/cases/' + CASE_ID + '/qa', async (route) => {
      requestBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { document: 'AIMIE answer', exhibits: [] } }),
      });
    });

    await page.goto('/cases/' + CASE_ID + '/qa');
    await page.getByRole('button', { name: 'QA controls', exact: true }).click();
    const controls = page.getByRole('dialog', { name: 'QA controls' });
    await controls.getByRole('button', { name: 'Brief' }).click();
    await page.getByRole('option', { name: 'Verbose' }).click();
    await expect(controls.getByRole('button', { name: 'Verbose' })).toBeVisible();
    await controls.getByRole('checkbox', { name: 'Use setting' }).check();
    await expect(controls.getByText("AIMIE will answer from the opposition's perspective")).toBeVisible();
    await controls.getByRole('button', { name: 'Close QA controls' }).click();

    await page.locator('textarea[name="requestText"]').fill('What happened?');
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect.poll(() => requestBody).toMatchObject({
      input: 'What happened?',
      verbosityLevel: 'high',
      swapRoles: true,
    });
    await expect(page.getByText('AIMIE answer')).toBeVisible();
    await page.getByRole('button', { name: 'QA controls', exact: true }).click();
    await expect(controls.getByRole('button', { name: 'Export Chat' })).toBeEnabled();

    await controls.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByText('AIMIE answer')).toHaveCount(0);
    await page.getByRole('button', { name: 'QA controls', exact: true }).click();
    await expect(controls.getByRole('button', { name: 'Export Chat' })).toBeDisabled();
  });

  test('opens and closes QA controls on mobile without submitting', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installCommonRoutes(page, caseGroup);
    await page.goto('/cases/' + CASE_ID + '/qa');

    await page.getByRole('button', { name: 'QA controls', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'QA controls' });
    await expect(drawer.getByRole('button', { name: 'Brief' })).toBeVisible();
    await expect(drawer.getByRole('checkbox', { name: 'Use setting' })).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Export Chat' })).toBeDisabled();
    await drawer.getByRole('button', { name: 'Close QA controls' }).click();
    await expect(drawer.locator('[data-slot="qa-controls-panel"]')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();
  });
});
