import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { installMockAuthRuntimeDependencies } from './fixtures/auth';

const casesApi = '**/api/accounts/cases';
const notificationsCountApi = '**/api/accounts/notifications/count**';
const negotiateApi = '**/api/realtime/negotiate';
const userAccessApi = '**/api/accounts/access**';
const initializeAccountApi = '**/api/accounts/initialize**';
const enableAccountsApi = '**/api/accounts/cases/enable**';

type CaseLifecycleEvent = {
  oid: string;
  notificationType: 'CASE_CREATED' | 'CASE_DELETED';
  id: string;
  createdAt: string;
  read: boolean;
  deleted: boolean;
  data: {
    accountId: string;
    status: 'STARTED' | 'SUCCESS' | 'SUCCESSFUL' | 'FAILED';
    errorMessage?: string;
  };
};

function makeCaseMap(accountId: string, firstName: string) {
  return {
    accountId,
    caseNumber: `CN-${firstName}`,
    agreedToCaseTerms: true,
    isGuest: false,
    canGenerateDeclaration: true,
    canUseQA: true,
    canAccessDocuments: true,
    record: {
      accountId,
      type: 'ACCOUNT_DETAILS',
      caseNumber: `CN-${firstName}`,
      personInformation: {
        firstName,
        lastName: 'Client',
        emailAddress: `${firstName.toLowerCase()}@example.com`,
      },
      filingRole: 'Plaintiff',
      state: 'WA',
      county: 'King',
      description: `Case for ${firstName}`,
      opposition: {
        firstName: 'Other',
        lastName: 'Party',
        filingRole: 'Defendant',
      },
    },
  };
}

function makeCasesResponse(caseMaps: Array<ReturnType<typeof makeCaseMap>>) {
  return [
    {
      id: '10000000-0000-4000-8000-000000000001',
      emailAddresses: ['e2e.user@example.com'],
      oids: ['10000000-0000-4000-8000-000000000002'],
      casesAccounts: caseMaps,
      accountId: '00000000-0000-0000-0000-000000000000',
      agreedToTerms: true,
      isActive: true,
    },
  ];
}

async function installRealtimeEmitter(page: Page) {
  await page.addInitScript(() => {
    type GroupMessageEvent = { message: { data: unknown } };
    type GroupMessageHandler = (event: GroupMessageEvent) => void;

    const handlers: GroupMessageHandler[] = [];
    let negotiateDone = false;
    const existing = (
      window as typeof window & {
        __PB_RUNTIME_DEPENDENCIES__?: Record<string, unknown>;
        __PB_E2E_EMIT_GROUP_MESSAGE__?: (payload: unknown) => void;
        __PB_E2E_GROUP_HANDLER_READY__?: () => boolean;
        __PB_E2E_NEGOTIATE_DONE__?: () => boolean;
      }
    ).__PB_RUNTIME_DEPENDENCIES__;

    (
      window as typeof window & {
        __PB_RUNTIME_DEPENDENCIES__?: Record<string, unknown>;
        __PB_E2E_EMIT_GROUP_MESSAGE__?: (payload: unknown) => void;
      }
    ).__PB_RUNTIME_DEPENDENCIES__ = {
      ...(existing ?? {}),
      createWebPubSubClient: () => ({
        on: (event: string, cb: GroupMessageHandler) => {
          if (event === 'group-message') {
            handlers.push(cb);
          }
        },
        start: async () => {},
        joinGroup: async () => {},
      }),
    };

    (
      window as typeof window & {
        __PB_E2E_EMIT_GROUP_MESSAGE__?: (payload: unknown) => void;
      }
    ).__PB_E2E_EMIT_GROUP_MESSAGE__ = (payload: unknown) => {
      for (const handler of handlers) {
        handler({ message: { data: payload } });
      }
    };

    (
      window as typeof window & {
        __PB_E2E_GROUP_HANDLER_READY__?: () => boolean;
      }
    ).__PB_E2E_GROUP_HANDLER_READY__ = () => handlers.length > 0;

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const [input] = args;
      const url =
        typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : String(input);

      const response = await originalFetch(...args);
      if (url.includes('/api/realtime/negotiate')) {
        negotiateDone = true;
      }
      return response;
    };

    (
      window as typeof window & {
        __PB_E2E_NEGOTIATE_DONE__?: () => boolean;
      }
    ).__PB_E2E_NEGOTIATE_DONE__ = () => negotiateDone;
  });
}

async function emitRealtimeNotice(page: Page, notice: CaseLifecycleEvent) {
  await page.waitForFunction(() => {
    return (
      (
        window as typeof window & {
          __PB_E2E_GROUP_HANDLER_READY__?: () => boolean;
          __PB_E2E_NEGOTIATE_DONE__?: () => boolean;
        }
      ).__PB_E2E_GROUP_HANDLER_READY__?.() === true &&
      (
        window as typeof window & {
          __PB_E2E_NEGOTIATE_DONE__?: () => boolean;
        }
      ).__PB_E2E_NEGOTIATE_DONE__?.() === true
    );
  });

  await page.evaluate((payload: CaseLifecycleEvent) => {
    (
      window as typeof window & {
        __PB_E2E_EMIT_GROUP_MESSAGE__?: (data: unknown) => void;
      }
    ).__PB_E2E_EMIT_GROUP_MESSAGE__?.(payload);
  }, notice);
}

function caseNameCell(page: Page, caseName: string) {
  return page
    .getByRole('listitem')
    .filter({ has: page.getByText(caseName, { exact: true }) });
}

test.describe('Cases page realtime case notification states', () => {
  test.beforeEach(async ({ page }) => {
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
  });

  test('adds a disabled pending row for STARTED and refreshes full list on SUCCESSFUL', async ({
    page,
  }) => {
    await installRealtimeEmitter(page);

    const existingCaseId = '20000000-0000-4000-8000-000000000001';
    const newCaseId = '20000000-0000-4000-8000-000000000002';

    let caseMaps = [makeCaseMap(existingCaseId, 'Existing')];
    await page.route(casesApi, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeCasesResponse(caseMaps)),
      });
    });

    await page.goto('/cases');

    await expect(
      caseNameCell(page, 'Existing Client v. Other Party'),
    ).toBeVisible();
    await expect(
      page.locator(`a[href="/cases/${existingCaseId}"]`).first(),
    ).toBeVisible();

    const startedEvent: CaseLifecycleEvent = {
      oid: 'e2e-user-oid',
      notificationType: 'CASE_CREATED',
      id: 'case-create-started-1',
      createdAt: new Date().toISOString(),
      read: false,
      deleted: false,
      data: {
        accountId: newCaseId,
        status: 'STARTED',
      },
    };
    await emitRealtimeNotice(page, startedEvent);

    await expect(page.getByText(`Case ${newCaseId}`)).toBeVisible();
    await expect(
      page.getByText(
        'Case creation started. Case details are not available yet.',
      ),
    ).toBeVisible();
    await expect(page.locator(`a[href="/cases/${newCaseId}"]`)).toHaveCount(0);

    caseMaps = [
      makeCaseMap(existingCaseId, 'Existing'),
      makeCaseMap(newCaseId, 'NewlyAdded'),
    ];
    const successEvent: CaseLifecycleEvent = {
      ...startedEvent,
      id: 'case-create-success-1',
      data: {
        accountId: newCaseId,
        status: 'SUCCESSFUL',
      },
    };
    await emitRealtimeNotice(page, successEvent);

    await expect(
      caseNameCell(page, 'NewlyAdded Client v. Other Party'),
    ).toBeVisible();
    await expect(
      page.locator(`a[href="/cases/${newCaseId}"]`).first(),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Case creation started. Case details are not available yet.',
      ),
    ).toHaveCount(0);
  });

  test('shows warning modal and removes pending row for CASE_CREATED FAILED', async ({
    page,
  }) => {
    await installRealtimeEmitter(page);

    const existingCaseId = '00000000-0000-4000-8000-000000001002';
    const failedCaseId = '00000000-0000-4000-8000-000000001003';
    const caseMaps = [makeCaseMap(existingCaseId, 'Stable')];

    await page.route(casesApi, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeCasesResponse(caseMaps)),
      });
    });

    await page.goto('/cases');
    await expect(
      caseNameCell(page, 'Stable Client v. Other Party'),
    ).toBeVisible();

    const startedEvent: CaseLifecycleEvent = {
      oid: 'e2e-user-oid',
      notificationType: 'CASE_CREATED',
      id: 'case-create-started-fail-1',
      createdAt: new Date().toISOString(),
      read: false,
      deleted: false,
      data: {
        accountId: failedCaseId,
        status: 'STARTED',
      },
    };
    await emitRealtimeNotice(page, startedEvent);
    await expect(page.getByText(`Case ${failedCaseId}`)).toBeVisible();

    const failedEvent: CaseLifecycleEvent = {
      ...startedEvent,
      id: 'case-create-failed-1',
      data: {
        accountId: failedCaseId,
        status: 'FAILED',
        errorMessage: 'Backend case creation failure',
      },
    };
    await emitRealtimeNotice(page, failedEvent);

    await expect(
      page.getByRole('heading', { name: 'Case Creation Failed' }),
    ).toBeVisible();
    await expect(page.getByText('Backend case creation failure')).toBeVisible();
    await expect(
      page.getByText(
        'Case creation failed. This entry will disappear shortly.',
      ),
    ).toBeVisible();
    await expect(page.getByText(`Case ${failedCaseId}`)).toBeHidden({
      timeout: 4000,
    });
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(
      caseNameCell(page, 'Stable Client v. Other Party'),
    ).toBeVisible();
  });

  test('grays out matching case on CASE_DELETED STARTED and refreshes list on SUCCESS', async ({
    page,
  }) => {
    await installRealtimeEmitter(page);

    const stableCaseId = '00000000-0000-4000-8000-000000001005';
    const deletingCaseId = '00000000-0000-4000-8000-000000001006';

    let caseMaps = [
      makeCaseMap(stableCaseId, 'Active'),
      makeCaseMap(deletingCaseId, 'Deleting'),
    ];
    await page.route(casesApi, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeCasesResponse(caseMaps)),
      });
    });

    await page.goto('/cases');
    await expect(
      caseNameCell(page, 'Deleting Client v. Other Party'),
    ).toBeVisible();
    await expect(
      page.locator(`a[href="/cases/${deletingCaseId}"]`).first(),
    ).toBeVisible();

    const deleteStartedEvent: CaseLifecycleEvent = {
      oid: 'e2e-user-oid',
      notificationType: 'CASE_DELETED',
      id: 'case-delete-started-1',
      createdAt: new Date().toISOString(),
      read: false,
      deleted: false,
      data: {
        accountId: deletingCaseId,
        status: 'STARTED',
      },
    };
    await emitRealtimeNotice(page, deleteStartedEvent);

    await expect(
      caseNameCell(page, 'Deleting Client v. Other Party').getByText('Deleting', { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(`a[href="/cases/${deletingCaseId}"]`),
    ).toHaveCount(0);

    caseMaps = [makeCaseMap(stableCaseId, 'Active')];
    const deleteSuccessEvent: CaseLifecycleEvent = {
      ...deleteStartedEvent,
      id: 'case-delete-success-1',
      data: {
        accountId: deletingCaseId,
        status: 'SUCCESS',
      },
    };
    await emitRealtimeNotice(page, deleteSuccessEvent);

    await expect(
      caseNameCell(page, 'Deleting Client v. Other Party'),
    ).toHaveCount(0);
    await expect(
      caseNameCell(page, 'Active Client v. Other Party'),
    ).toBeVisible();
  });

  test('shows warning modal for CASE_DELETED FAILED', async ({ page }) => {
    await installRealtimeEmitter(page);

    const stableCaseId = '00000000-0000-4000-8000-000000001009';
    const deletingCaseId = '00000000-0000-4000-8000-000000001010';
    const caseMaps = [
      makeCaseMap(stableCaseId, 'Stable'),
      makeCaseMap(deletingCaseId, 'FailDelete'),
    ];

    await page.route(casesApi, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeCasesResponse(caseMaps)),
      });
    });

    await page.goto('/cases');
    await expect(
      caseNameCell(page, 'FailDelete Client v. Other Party'),
    ).toBeVisible();

    const deleteStartedEvent: CaseLifecycleEvent = {
      oid: 'e2e-user-oid',
      notificationType: 'CASE_DELETED',
      id: 'case-delete-started-fail-1',
      createdAt: new Date().toISOString(),
      read: false,
      deleted: false,
      data: {
        accountId: deletingCaseId,
        status: 'STARTED',
      },
    };
    await emitRealtimeNotice(page, deleteStartedEvent);
    await expect(
      caseNameCell(page, 'FailDelete Client v. Other Party').getByText('Deleting', { exact: true }),
    ).toBeVisible();

    const deleteFailedEvent: CaseLifecycleEvent = {
      ...deleteStartedEvent,
      id: 'case-delete-failed-1',
      data: {
        accountId: deletingCaseId,
        status: 'FAILED',
        errorMessage: 'Backend case deletion failure',
      },
    };
    await emitRealtimeNotice(page, deleteFailedEvent);

    await expect(
      page.getByRole('heading', { name: 'Case Deletion Failed' }),
    ).toBeVisible();
    await expect(page.getByText('Backend case deletion failure')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(
      caseNameCell(page, 'FailDelete Client v. Other Party'),
    ).toBeVisible();
  });
});
