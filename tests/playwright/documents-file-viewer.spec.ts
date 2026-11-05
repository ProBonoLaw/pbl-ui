import { expect, test, type Page } from '@playwright/test';
import { installMockAuthRuntimeDependencies } from './fixtures/auth';

const notificationsCountApi = '**/api/accounts/notifications/count**';
const negotiateApi = '**/api/realtime/negotiate';
const userAccessApi = '**/api/accounts/access**';
const initializeAccountApi = '**/api/accounts/initialize**';
const enableAccountsApi = '**/api/accounts/cases/enable**';
const graphMeApi = 'https://graph.microsoft.com/beta/me';
const graphPhotoApi = 'https://graph.microsoft.com/beta/me/photo/$value';

const caseDetailsApi = /\/api\/accounts\/cases\/[0-9a-fA-F-]{36}$/;
const documentsApi = /\/api\/accounts\/cases\/[0-9a-fA-F-]{36}\/documents(?:\/.*)?/;
const sharepointProxyApi =
  /\/api\/accounts\/cases\/[0-9a-fA-F-]{36}\/sharepoint-proxy\?.*/;

const nowIso = '2026-01-01T00:00:00.000Z';

function makeCaseDetailsResponse(caseId: string) {
  return {
    id: '00000000-0000-4000-8000-000000001014',
    emailAddresses: ['e2e.user@example.com'],
    oids: ['00000000-0000-4000-8000-000000001015'],
    casesAccounts: [
      {
        accountId: caseId,
        caseNumber: 'CN-E2E-FILEVIEWER',
        agreedToCaseTerms: true,
        isGuest: false,
        canGenerateDeclaration: true,
        canUseQA: true,
        canAccessDocuments: true,
      },
    ],
    accountId: '00000000-0000-4000-8000-000000001016',
    agreedToTerms: true,
    isActive: true,
  };
}

function makeSharePointMetadata(id: string, typeName: string, etag?: string) {
  return {
    id,
    uri: id,
    // Keep both keys so fixtures remain compatible with schema/type-name refactors.
    type: typeName,
    typeName,
    etag,
  };
}

function makeListItemAllFields(id: number) {
  return {
    __metadata: makeSharePointMetadata(
      `https://example.test/list-items/${id}`,
      'SP.ListItem',
    ),
    FileSystemObjectType: 0,
    Id: id,
    ServerRedirectedEmbedUri: null,
    ServerRedirectedEmbedUrl: '',
    ContentTypeId: '0x0101',
    OData__ColorTag: null,
    ComplianceAssetId: null,
    Title: null,
    ID: id,
    Created: nowIso,
    AuthorId: 1,
    Modified: nowIso,
    EditorId: 1,
    OData__CopySource: null,
    CheckoutUserId: null,
    OData__UIVersionString: '1.0',
    GUID: `70000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
  };
}

function makeSharePointFile(
  caseId: string,
  requestPath: string,
  name: string,
  id: number,
) {
  return {
    __metadata: makeSharePointMetadata(
      `https://example.test/files/${id}`,
      'SP.File',
      '"1"',
    ),
    ListItemAllFields: makeListItemAllFields(id),
    CheckInComment: '',
    CheckOutType: 0,
    ContentTag: 'content-tag',
    CustomizedPageStatus: 0,
    ETag: '"1"',
    Exists: true,
    ExistsAllowThrowForPolicyFailures: true,
    ExistsWithException: false,
    IrmEnabled: false,
    Length: '128',
    Level: 1,
    LinkingUri: null,
    LinkingUrl: '',
    MajorVersion: 1,
    MinorVersion: 0,
    Name: name,
    ServerRelativeUrl: `/sites/${caseId}/Shared Documents/${requestPath}/${name}`,
    TimeCreated: nowIso,
    TimeLastModified: nowIso,
    Title: null,
    UIVersion: 1,
    UIVersionLabel: '1.0',
    UniqueId: `71000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
  };
}

function makeDocumentsResponse(
  caseId: string,
  requestPath: string,
  fileNames: string[],
  documentAccessRole: 'CONTRIBUTOR' | 'VIEW-ONLY' = 'CONTRIBUTOR',
) {
  return {
    d: {
      __metadata: makeSharePointMetadata(
        `https://example.test/folder/${requestPath}`,
        'SP.Folder',
      ),
      Files: {
        results: fileNames.map((name, idx) =>
          makeSharePointFile(caseId, requestPath, name, idx + 11),
        ),
      },
      Folders: {
        results: [],
      },
      Exists: true,
      ExistsAllowThrowForPolicyFailures: true,
      ExistsWithException: false,
      IsWOPIEnabled: false,
      ItemCount: fileNames.length,
      Name: requestPath.split('/').at(-1) ?? requestPath,
      ProgID: null,
      ServerRelativeUrl: `/sites/${caseId}/Shared Documents/${requestPath}`,
      TimeCreated: nowIso,
      TimeLastModified: nowIso,
      UniqueId: '00000000-0000-4000-8000-000000001029',
      WelcomePage: '',
    },
    baseUrl: 'sharepoint.example.test',
    documentAccessRole,
  };
}

function makeGeneratedFileResponse(
  caseId: string,
  requestPath: string,
  filename: string,
  content: string,
) {
  return {
    d: makeSharePointFile(caseId, requestPath, filename, 999),
    baseUrl: 'sharepoint.example.test',
    content: Buffer.from(content, 'utf-8').toString('base64'),
  };
}

async function installCommonAppRoutes(page: Page) {
  await installMockAuthRuntimeDependencies(page);

  await page.route(graphMeApi, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '00000000-0000-4000-8000-000000001017',
        accountEnabled: true,
        createdDateTime: nowIso,
        displayName: 'E2E User',
        givenName: 'E2E',
        isLicenseReconciliationNeeded: false,
        mailNickname: 'e2e.user',
        refreshTokensValidFromDateTime: nowIso,
        securityIdentifier: 'S-1-5-21-e2e',
        signInSessionsValidFromDateTime: nowIso,
        surname: 'User',
        userPrincipalName: 'e2e.user@example.com',
        userType: 'Member',
        extension_example_IsAttorney: true,
      }),
    }),
  );

  await page.route(graphPhotoApi, (route) =>
    route.fulfill({
      status: 404,
      body: '',
    }),
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
    route.fulfill({
      status: 204,
      body: '',
    }),
  );
}

async function openFileActions(page: Page) {
  await page.getByRole('button', { name: 'File actions', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'File actions' });
  await expect(drawer.locator('[data-slot="file-actions-panel"]')).toBeVisible();
  return drawer;
}

test.describe('Documents FileViewer', () => {
  test.beforeEach(async ({ page }) => {
    await installCommonAppRoutes(page);
  });

  test('downloads current file and closes the viewer', async ({ page }) => {
    const caseId = '00000000-0000-4000-8000-000000001030';
    const requestPath = 'Evidence';
    const fileName = 'Complaint.pdf';
    const fileNames = [fileName, 'Witness-List.docx'];

    let fileDownloadRequests = 0;

    await page.route(caseDetailsApi, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      const url = new URL(route.request().url());
      const routedCaseId = url.pathname.split('/').at(-1);
      if (!routedCaseId) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Missing caseId' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeCaseDetailsResponse(routedCaseId)),
      });
    });

    await page.route(sharepointProxyApi, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          previewUrl: 'https://example.test/preview/complaint',
        }),
      });
    });

    await page.route(documentsApi, async (route) => {
      const method = route.request().method();
      const url = new URL(route.request().url());
      const isFile = url.searchParams.get('isFile') === 'true';

      if (method === 'GET' && isFile) {
        fileDownloadRequests += 1;
        const requestedFilename = decodeURIComponent(
          url.pathname.split('/').at(-1) ?? '',
        );

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            makeGeneratedFileResponse(
              caseId,
              requestPath,
              requestedFilename,
              `binary content for ${requestedFilename}`,
            ),
          ),
        });
        return;
      }

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            makeDocumentsResponse(caseId, requestPath, fileNames),
          ),
        });
        return;
      }

      await route.continue();
    });

    await page.goto(
      `/cases/${caseId}/documents/root/${requestPath}?file=${encodeURIComponent(fileName)}`,
    );

    await expect(page.getByRole('heading', { name: fileName })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Folder Controls' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Upload files' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Download' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);

    for (const viewport of [
      { width: 320, height: 568 },
      { width: 440, height: 956 },
      { width: 1280, height: 720 },
    ]) {
      await page.setViewportSize(viewport);
      const content = page.locator('[data-slot="page-content"]');
      const iframe = page.getByTitle('Authenticated Content');
      await expect(iframe).toBeVisible();
      const contentBox = await content.boundingBox();
      const iframeBox = await iframe.boundingBox();
      expect(iframeBox!.y + iframeBox!.height).toBeLessThanOrEqual(contentBox!.y + contentBox!.height + 1);
      expect(await content.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight)).toBeLessThanOrEqual(1);
    }

    await page.setViewportSize({ width: 440, height: 956 });
    const actions = await openFileActions(page);
    await expect.poll(async () => {
      const box = await actions.locator('[data-slot="file-actions-panel"]').boundingBox();
      return box ? box.x + box.width : Infinity;
    }).toBeLessThanOrEqual(440);
    await actions.getByRole('button', { name: 'Download' }).click();
    await expect.poll(() => fileDownloadRequests).toBe(1);

    await openFileActions(page);
    await Promise.all([
      page.waitForURL(`/cases/${caseId}/documents/root/${requestPath}`),
      actions.getByRole('button', { name: 'Close', exact: true }).click(),
    ]);

    await expect(page.getByRole('heading', { name: fileName })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Folder Controls' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: fileName }).first(),
    ).toBeVisible();
  });

  test('deletes current file after confirmation and removes it from list', async ({
    page,
  }) => {
    const caseId = '00000000-0000-4000-8000-000000001036';
    const requestPath = 'Evidence';
    const targetFile = 'Complaint.pdf';
    let fileNames = [targetFile, 'Witness-List.docx'];

    let deleteRequests = 0;

    await page.route(caseDetailsApi, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeCaseDetailsResponse(caseId)),
      });
    });

    await page.route(sharepointProxyApi, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          previewUrl: 'https://example.test/preview/complaint',
        }),
      });
    });

    await page.route(documentsApi, async (route) => {
      const method = route.request().method();
      const url = new URL(route.request().url());
      const isFile = url.searchParams.get('isFile') === 'true';

      if (method === 'DELETE' && isFile) {
        deleteRequests += 1;
        const requestedFilename = decodeURIComponent(
          url.pathname.split('/').at(-1) ?? '',
        );
        fileNames = fileNames.filter((name) => name !== requestedFilename);
        await route.fulfill({ status: 204, body: '' });
        return;
      }

      if (method === 'GET' && isFile) {
        const requestedFilename = decodeURIComponent(
          url.pathname.split('/').at(-1) ?? '',
        );

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            makeGeneratedFileResponse(
              caseId,
              requestPath,
              requestedFilename,
              `binary content for ${requestedFilename}`,
            ),
          ),
        });
        return;
      }

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            makeDocumentsResponse(caseId, requestPath, fileNames),
          ),
        });
        return;
      }

      await route.continue();
    });

    await page.goto(
      `/cases/${caseId}/documents/root/${requestPath}?file=${encodeURIComponent(targetFile)}`,
    );

    await expect(page.getByRole('heading', { name: targetFile })).toBeVisible();

    const actions = await openFileActions(page);
    await actions.getByRole('button', { name: 'Delete' }).click();
    const dialog = page.getByRole('dialog', { name: 'Confirm Delete' });
    await expect(
      dialog.getByRole('heading', { name: 'Confirm Delete' }),
    ).toBeVisible();

    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect.poll(() => deleteRequests).toBe(1);
    await expect(page).toHaveURL(
      `/cases/${caseId}/documents/root/${requestPath}`,
    );
    await expect(page.getByRole('button', { name: targetFile })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Witness-List.docx' }).first(),
    ).toBeVisible();
  });
  test('hides delete for current file when SharePoint role is Viewer', async ({
    page,
  }) => {
    const caseId = '00000000-0000-4000-8000-000000001041';
    const requestPath = 'Evidence';
    const targetFile = 'Complaint.pdf';
    const fileNames = [targetFile, 'Witness-List.docx'];
    let deleteRequests = 0;

    await page.route(caseDetailsApi, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeCaseDetailsResponse(caseId)),
      });
    });

    await page.route(sharepointProxyApi, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          previewUrl: 'https://example.test/preview/complaint',
        }),
      });
    });

    await page.route(documentsApi, async (route) => {
      const method = route.request().method();
      const url = new URL(route.request().url());
      const isFile = url.searchParams.get('isFile') === 'true';

      if (method === 'DELETE' && isFile) {
        deleteRequests += 1;
        await route.fulfill({ status: 204, body: '' });
        return;
      }

      if (method === 'GET' && isFile) {
        const requestedFilename = decodeURIComponent(
          url.pathname.split('/').at(-1) ?? '',
        );

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            makeGeneratedFileResponse(
              caseId,
              requestPath,
              requestedFilename,
              `binary content for ${requestedFilename}`,
            ),
          ),
        });
        return;
      }

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            makeDocumentsResponse(caseId, requestPath, fileNames, 'VIEW-ONLY'),
          ),
        });
        return;
      }

      await route.continue();
    });

    await page.goto(
      `/cases/${caseId}/documents/root/${requestPath}?file=${encodeURIComponent(targetFile)}`,
    );

    await expect(page.getByRole('heading', { name: targetFile })).toBeVisible();
    const actions = await openFileActions(page);
    await expect(actions.getByRole('button', { name: 'Download' })).toBeVisible();
    await expect(actions.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
    await expect(actions.getByRole('button', { name: 'Delete' })).toHaveCount(0);
    expect(deleteRequests).toBe(0);
  });
});
