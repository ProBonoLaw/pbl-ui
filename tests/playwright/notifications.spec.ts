import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { installMockAuthRuntimeDependencies } from './fixtures/auth';

const notificationsApi = '**/api/accounts/notifications**';
const notificationsCountApi = '**/api/accounts/notifications/count**';
const negotiateApi = '**/api/realtime/negotiate';
const userAccessApi = '**/api/accounts/access**';
const initializeAccountApi = '**/api/accounts/initialize**';
const enableAccountsApi = '**/api/accounts/cases/enable**';

type E2ENotice = {
  oid: string;
  notificationType: 'CASE_CREATED' | 'CASE_DELETED';
  id: string;
  createdAt: string;
  read: boolean;
  deleted: boolean;
  data: {
    accountId: string;
    status: 'STARTED' | 'SUCCESS' | 'FAILED';
  };
};

async function installRealtimeEmitter(page: Page) {
  await page.addInitScript(() => {
    type GroupMessageEvent = { message: { data: unknown } };
    type GroupMessageHandler = (event: GroupMessageEvent) => void;
    type ClientEventHandler = (event: GroupMessageEvent) => void;
    type MockClient = {
      getClientAccessUrl: () => Promise<string>;
      handlers: Map<string, ClientEventHandler[]>;
    };

    const handlers: GroupMessageHandler[] = [];
    const clients: MockClient[] = [];
    let negotiateDone = false;
    const existing = (globalThis as typeof globalThis & {
      __PB_RUNTIME_DEPENDENCIES__?: Record<string, unknown>;
      __PB_E2E_EMIT_GROUP_MESSAGE__?: (payload: unknown) => void;
      __PB_E2E_GROUP_HANDLER_READY__?: () => boolean;
      __PB_E2E_NEGOTIATE_DONE__?: () => boolean;
      __PB_E2E_RECONNECT__?: () => Promise<void>;
      __PB_E2E_CLIENT_COUNT__?: () => number;
    }).__PB_RUNTIME_DEPENDENCIES__;

    (
      globalThis as typeof globalThis & {
        __PB_RUNTIME_DEPENDENCIES__?: Record<string, unknown>;
        __PB_E2E_EMIT_GROUP_MESSAGE__?: (payload: unknown) => void;
      }
    ).__PB_RUNTIME_DEPENDENCIES__ = {
      ...existing,
      createWebPubSubClient: (options: {
        getClientAccessUrl: () => Promise<string>;
      }) => {
        const client: MockClient = {
          getClientAccessUrl: options.getClientAccessUrl,
          handlers: new Map(),
        };
        clients.push(client);

        return {
          on: (event: string, cb: ClientEventHandler) => {
            if (event === 'group-message') {
              handlers.push(cb);
            }

            const eventHandlers = client.handlers.get(event) ?? [];
            eventHandlers.push(cb);
            client.handlers.set(event, eventHandlers);
          },
          start: async () => {
            await client.getClientAccessUrl();
            for (const handler of client.handlers.get('connected') ?? []) {
              handler({ message: { data: undefined } });
            }
          },
          joinGroup: async () => {},
        };
      },
    };

    (
      globalThis as typeof globalThis & {
        __PB_E2E_EMIT_GROUP_MESSAGE__?: (payload: unknown) => void;
      }
    ).__PB_E2E_EMIT_GROUP_MESSAGE__ = (payload: unknown) => {
      for (const handler of handlers) {
        handler({ message: { data: payload } });
      }
    };

    (
      globalThis as typeof globalThis & {
        __PB_E2E_GROUP_HANDLER_READY__?: () => boolean;
      }
    ).__PB_E2E_GROUP_HANDLER_READY__ = () => handlers.length > 0;

    (
      globalThis as typeof globalThis & {
        __PB_E2E_RECONNECT__?: () => Promise<void>;
        __PB_E2E_CLIENT_COUNT__?: () => number;
      }
    ).__PB_E2E_RECONNECT__ = async () => {
      for (const client of clients) {
        for (const handler of client.handlers.get('disconnected') ?? []) {
          handler({ message: { data: undefined } });
        }
        await client.getClientAccessUrl();
        for (const handler of client.handlers.get('connected') ?? []) {
          handler({ message: { data: undefined } });
        }
      }
    };

    (
      globalThis as typeof globalThis & {
        __PB_E2E_CLIENT_COUNT__?: () => number;
      }
    ).__PB_E2E_CLIENT_COUNT__ = () => clients.length;

    const originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = async (...args) => {
      const [input] = args;
      let url: string;
      if (typeof input === 'string') {
        url = input;
      } else if (input instanceof Request) {
        url = input.url;
      } else {
        url = String(input);
      }

      const response = await originalFetch(...args);
      if (url.includes('/api/realtime/negotiate')) {
        negotiateDone = true;
      }
      return response;
    };

    (
      globalThis as typeof globalThis & {
        __PB_E2E_NEGOTIATE_DONE__?: () => boolean;
      }
    ).__PB_E2E_NEGOTIATE_DONE__ = () => negotiateDone;
  });
}

async function emitRealtimeNotice(
  page: Page,
  notice: E2ENotice,
) {
  await page.waitForFunction(() => {
    return (
      (
        globalThis as typeof globalThis & {
          __PB_E2E_GROUP_HANDLER_READY__?: () => boolean;
          __PB_E2E_NEGOTIATE_DONE__?: () => boolean;
        }
      ).__PB_E2E_GROUP_HANDLER_READY__?.() === true &&
      (
        globalThis as typeof globalThis & {
          __PB_E2E_NEGOTIATE_DONE__?: () => boolean;
        }
      ).__PB_E2E_NEGOTIATE_DONE__?.() === true
    );
  });

  await page.evaluate((payload: E2ENotice) => {
    (
      globalThis as typeof globalThis & {
        __PB_E2E_EMIT_GROUP_MESSAGE__?: (data: unknown) => void;
      }
    ).__PB_E2E_EMIT_GROUP_MESSAGE__?.(payload);
  }, notice);
}

test.describe('Notifications page', () => {
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

  test('renegotiates the access URL without replacing the client', async ({
    page,
  }) => {
    await installRealtimeEmitter(page);

    let negotiationRequests = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/realtime/negotiate')) {
        negotiationRequests += 1;
      }
    });

    await page.goto('/');
    await page.waitForFunction(() => {
      const runtime = globalThis as typeof globalThis & {
        __PB_E2E_CLIENT_COUNT__?: () => number;
        __PB_E2E_RECONNECT__?: () => Promise<void>;
      };

      return (
        runtime.__PB_E2E_CLIENT_COUNT__?.() !== undefined &&
        runtime.__PB_E2E_CLIENT_COUNT__() > 0 &&
        runtime.__PB_E2E_RECONNECT__ !== undefined
      );
    });

    const initialClientCount = await page.evaluate(() => {
      return (
        globalThis as typeof globalThis & {
          __PB_E2E_CLIENT_COUNT__?: () => number;
        }
      ).__PB_E2E_CLIENT_COUNT__?.();
    });
    const initialNegotiationRequests = negotiationRequests;

    await page.evaluate(async () => {
      await (
        globalThis as typeof globalThis & {
          __PB_E2E_RECONNECT__?: () => Promise<void>;
        }
      ).__PB_E2E_RECONNECT__?.();
    });

    await expect
      .poll(() => negotiationRequests)
      .toBe(initialNegotiationRequests + initialClientCount!);
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            (
              globalThis as typeof globalThis & {
                __PB_E2E_CLIENT_COUNT__?: () => number;
              }
            ).__PB_E2E_CLIENT_COUNT__?.(),
        ),
      )
      .toBe(initialClientCount);
  });

  test('shows error banner when fetch fails', async ({ page }) => {
    await page.route(notificationsApi, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'failure' }),
      }),
    );

    await page.goto('/notifications');

    await expect(
      page.getByText(
        'Unable to load notifications right now. Please try again.',
      ),
    ).toBeVisible();
  });

  test('collapses filters on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route(notificationsApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      }),
    );

    await page.goto('/notifications');

    const accordionButton = page.getByRole('button', {
      name: 'Filters & Actions',
    });
    await expect(accordionButton).toBeVisible();

    const searchInput = page.getByLabel('Search');
    await expect(searchInput).toBeHidden();

    await accordionButton.click();
    await expect(searchInput).toBeVisible();
  });

  test('shows filters on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route(notificationsApi, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      }),
    );

    await page.goto('/notifications');

    await expect(page.getByLabel('Search')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Filters & Actions' }),
    ).toHaveCount(0);
  });

  test('renders preliminary and evidence extraction ingestion notifications', async ({ page }) => {
    const ingestionNotices = [
      {
        oid: 'e2e-user-oid',
        notificationType: 'INGESTION',
        id: 'notice-ingestion-preliminary',
        createdAt: new Date().toISOString(),
        read: false,
        deleted: false,
        data: {
          accountId: 'acct-ingestion-1',
          status: 'PRELIMINARY',
          filepath: 'root/acct-ingestion-1/documents/preliminary.pdf',
        },
      },
      {
        oid: 'e2e-user-oid',
        notificationType: 'INGESTION',
        id: 'notice-ingestion-evidence-extraction',
        createdAt: new Date().toISOString(),
        read: false,
        deleted: false,
        data: {
          accountId: 'acct-ingestion-1',
          status: 'EVIDENCE_EXTRACTION',
          filepath: 'root/acct-ingestion-1/documents/evidence.pdf',
        },
      },
    ];

    await page.route(notificationsApi, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/api/accounts/notifications/count')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: ingestionNotices.length }),
        });
        return;
      }

      if (
        route.request().method() === 'GET' &&
        url.pathname.endsWith('/api/accounts/notifications')
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: ingestionNotices }),
        });
        return;
      }

      await route.continue();
    });

    await page.goto('/notifications');

    await expect(
      page.getByText('Ingestion', { exact: true }),
    ).toHaveCount(2);
    await expect(
      page.getByText('Preliminary', { exact: true }),
    ).toHaveClass(/bg-orange-50/);
    await expect(
      page.getByText(
        'Preliminary ingestion completed for document root/acct-ingestion-1/documents/preliminary.pdf.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByText('Evidence Extraction', { exact: true }),
    ).toHaveClass(/bg-orange-50/);
    await expect(
      page.getByText('Unread', { exact: true }).first(),
    ).toHaveClass(/bg-blue-50/);
    await expect(
      page.getByText(
        'Evidence extraction completed for document root/acct-ingestion-1/documents/evidence.pdf.',
        { exact: true },
      ),
    ).toBeVisible();
  });

  test('renders ingestion success and failure badges with distinct colors', async ({ page }) => {
    const ingestionNotices = [
      {
        oid: 'e2e-user-oid',
        notificationType: 'INGESTION',
        id: 'notice-ingestion-success',
        createdAt: new Date().toISOString(),
        read: false,
        deleted: false,
        data: {
          accountId: 'acct-ingestion-1',
          status: 'SUCCESS',
          filepath: 'root/acct-ingestion-1/documents/success.pdf',
        },
      },
      {
        oid: 'e2e-user-oid',
        notificationType: 'INGESTION',
        id: 'notice-ingestion-failed',
        createdAt: new Date().toISOString(),
        read: false,
        deleted: false,
        data: {
          accountId: 'acct-ingestion-1',
          status: 'FAILED',
          errorMessage: 'Document processing failed',
          filepath: 'root/acct-ingestion-1/documents/failed.pdf',
        },
      },
    ];

    await page.route(notificationsApi, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/api/accounts/notifications/count')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: ingestionNotices.length }),
        });
        return;
      }

      if (
        route.request().method() === 'GET' &&
        url.pathname.endsWith('/api/accounts/notifications')
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: ingestionNotices }),
        });
        return;
      }

      await route.continue();
    });

    await page.goto('/notifications');

    const successBadge = page.getByText('Success', { exact: true });
    const failureBadge = page.getByText('Failed', { exact: true });
    await expect(successBadge).toHaveClass(/bg-green-50/);
    await expect(failureBadge).toHaveClass(/bg-red-50/);
    await expect(
      page.getByText(
        'Document root/acct-ingestion-1/documents/success.pdf ingestion completed.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Ingestion failed for document root/acct-ingestion-1/documents/failed.pdf: Document processing failed',
        { exact: true },
      ),
    ).toBeVisible();
  });

  test('loads declaration notifications without declarationUrl', async ({ page }) => {
    let markReadSucceeds = false;
    const declarationNotice = {
      oid: 'e2e-user-oid',
      notificationType: 'DECLARATION',
      id: 'notice-declaration-missing-url',
      createdAt: new Date().toISOString(),
      read: false,
      deleted: false,
      data: {
        accountId: 'acct-declaration-1',
        sessionId: 'session-declaration-1',
        requestId: 'request-declaration-1',
        requestText: 'Declaration ready without legacy URL',
        status: 'SUCCESS',
      },
    };

    await page.route(notificationsApi, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/api/accounts/notifications/count')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: 1 }),
        });
        return;
      }

      if (
        route.request().method() === 'GET' &&
        url.pathname.endsWith('/api/accounts/notifications')
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [declarationNotice] }),
        });
        return;
      }

      if (route.request().method() === 'PUT' && url.pathname.endsWith(`/api/accounts/notifications/${declarationNotice.id}`)) {
        await route.fulfill({ status: markReadSucceeds ? 204 : 500, body: '' });
        return;
      }

      await route.continue();
    });

    await page.goto('/notifications');

    await expect(page.getByText('Declaration', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Declaration ready without legacy URL'),
    ).toBeVisible();
    await expect(
      page.locator(
        'a[href="/cases/acct-declaration-1/declarations/request-declaration-1"]',
      ).first(),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Options for Declaration notification' }).click();
    await expect(page.getByRole('menuitem', { name: 'Mark as read' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
    const failedRead = page.waitForResponse((response) =>
      response.request().method() === 'PUT' &&
      response.url().includes(`/api/accounts/notifications/${declarationNotice.id}`) &&
      response.status() === 500,
    );
    await page.getByRole('menuitem', { name: 'Mark as read' }).click();
    await failedRead;
    await expect(page.getByText('Unread', { exact: true })).toBeVisible();

    markReadSucceeds = true;
    await page.getByRole('button', { name: 'Options for Declaration notification' }).click();
    await page.getByRole('menuitem', { name: 'Mark as read' }).click();
    await expect(page.getByText('Read', { exact: true })).toBeVisible();
    await expect(page.getByText('Unread', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Options for Declaration notification' }).click();
    await expect(page.getByRole('menuitem', { name: 'Mark as read' })).toHaveCount(0);
  });

  test('loads successful argument builder notifications with a view action', async ({ page }) => {
    const argumentBuilderNotice = {
      oid: 'e2e-user-oid',
      notificationType: 'ARGUMENT_BUILDER',
      id: 'notice-argument-builder-success',
      createdAt: new Date().toISOString(),
      read: false,
      deleted: false,
      data: {
        accountId: 'acct-argument-1',
        sessionId: 'session-argument-1',
        requestId: 'request-argument-1',
        requestText: 'Argument viewer ready',
        status: 'SUCCESS',
      },
    };

    await page.route(notificationsApi, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/api/accounts/notifications/count')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: 1 }),
        });
        return;
      }

      if (
        route.request().method() === 'GET' &&
        url.pathname.endsWith('/api/accounts/notifications')
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [argumentBuilderNotice] }),
        });
        return;
      }

      await route.continue();
    });

    await page.goto('/notifications');

    await expect(
      page.getByText('Argument builder', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Argument viewer ready')).toBeVisible();

    const argumentViewLink = page.locator(
      'a[href="/cases/acct-argument-1/argument-builder/request-argument-1"]',
    ).first();
    await expect(argumentViewLink).toHaveText('View');
    await expect(page.getByText('Unread', { exact: true })).toBeVisible();
  });

  test('increments chip for CASE_CREATED and shows it after chip click', async ({
    page,
  }) => {
    await installRealtimeEmitter(page);

    let unreadCount = 0;
    let notices: E2ENotice[] = [];

    await page.route(notificationsApi, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/api/accounts/notifications/count')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: unreadCount }),
        });
        return;
      }

      if (
        route.request().method() === 'GET' &&
        url.pathname.endsWith('/api/accounts/notifications')
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: notices }),
        });
        return;
      }

      await route.continue();
    });

    await page.goto('/');
    await expect(
      page.getByRole('link', { name: '0 unread notifications' }),
    ).toBeVisible();

    const caseCreatedNotice: E2ENotice = {
      oid: 'e2e-user-oid',
      notificationType: 'CASE_CREATED',
      id: 'notice-case-created-1',
      createdAt: new Date().toISOString(),
      read: false,
      deleted: false,
      data: {
        accountId: 'acct-created-1',
        status: 'SUCCESS',
      },
    };

    unreadCount = 1;
    notices = [caseCreatedNotice];
    await emitRealtimeNotice(page, caseCreatedNotice);

    const chip = page.getByRole('link', { name: '1 unread notification' });
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('1');

    await Promise.all([
      page.waitForURL(/\/notifications$/, { timeout: 10000 }),
      chip.click({ force: true }),
    ]);
    await expect(page.getByText('Case created')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('a[href="/cases/acct-created-1"]')).toHaveText('View');
  });

  test('increments chip for CASE_DELETED and shows it after chip click', async ({
    page,
  }) => {
    await installRealtimeEmitter(page);

    let unreadCount = 0;
    let notices: E2ENotice[] = [];

    await page.route(notificationsApi, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/api/accounts/notifications/count')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: unreadCount }),
        });
        return;
      }

      if (
        route.request().method() === 'GET' &&
        url.pathname.endsWith('/api/accounts/notifications')
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: notices }),
        });
        return;
      }

      await route.continue();
    });

    await page.goto('/');
    await expect(
      page.getByRole('link', { name: '0 unread notifications' }),
    ).toBeVisible();

    const caseDeletedNotice: E2ENotice = {
      oid: 'e2e-user-oid',
      notificationType: 'CASE_DELETED',
      id: 'notice-case-deleted-1',
      createdAt: new Date().toISOString(),
      read: false,
      deleted: false,
      data: {
        accountId: 'acct-deleted-1',
        status: 'SUCCESS',
      },
    };

    unreadCount = 1;
    notices = [caseDeletedNotice];
    await emitRealtimeNotice(page, caseDeletedNotice);

    const chip = page.getByRole('link', { name: '1 unread notification' });
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('1');

    await Promise.all([
      page.waitForURL(/\/notifications$/, { timeout: 10000 }),
      chip.click({ force: true }),
    ]);
    await expect(page.getByText('Case deleted')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Unread', { exact: true })).toBeVisible();
  });

  test('navigates to case page when the CASE_CREATED view action is clicked', async ({
    page,
  }) => {
    const caseCreatedNotice: E2ENotice = {
      oid: 'e2e-user-oid',
      notificationType: 'CASE_CREATED',
      id: 'notice-case-created-navigation',
      createdAt: new Date().toISOString(),
      read: false,
      deleted: false,
      data: {
        accountId: 'acct-created-nav-1',
        status: 'SUCCESS',
      },
    };

    await page.route(notificationsApi, async (route) => {
      const url = new URL(route.request().url());
      if (
        route.request().method() === 'GET' &&
        url.pathname.endsWith('/api/accounts/notifications')
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [caseCreatedNotice] }),
        });
        return;
      }

      await route.continue();
    });

    await page.goto('/notifications');

    const caseViewLink = page.locator('a[href="/cases/acct-created-nav-1"]').first();
    await expect(caseViewLink).toHaveText('View');

    await Promise.all([
      page.waitForURL(/\/cases\/acct-created-nav-1$/, { timeout: 10000 }),
      caseViewLink.click({ force: true }),
    ]);
  });
});
