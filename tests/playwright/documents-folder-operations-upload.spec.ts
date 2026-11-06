import { expect, test, type Page, type Route } from '@playwright/test';
import {
  installMockAuthRuntimeDependencies,
  makeMockGraphProfile,
} from './fixtures/auth';

const notificationsCountApi = '**/api/accounts/notifications/count**';
const negotiateApi = '**/api/realtime/negotiate';
const userAccessApi = '**/api/accounts/access**';
const initializeAccountApi = '**/api/accounts/initialize**';
const enableAccountsApi = '**/api/accounts/cases/enable**';
const graphMeApi = 'https://graph.microsoft.com/beta/me';
const graphPhotoApi = 'https://graph.microsoft.com/beta/me/photo/$value';

const caseDetailsApi = /\/api\/accounts\/cases\/[0-9a-fA-F-]{36}$/;
const documentsApi =
  /\/api\/accounts\/cases\/[0-9a-fA-F-]{36}\/documents(?:\/.*)?/;

const nowIso = '2026-01-01T00:00:00.000Z';

type DirectoryState = {
  files: string[];
  folders: string[];
};

type DocumentsState = Record<string, DirectoryState>;

type DocumentAccess = {
  role: 'CONTRIBUTOR' | 'VIEW-ONLY';
  canCreateFolders: boolean;
  canRenameFolders: boolean;
  canDeleteFolders: boolean;
  canUploadFiles: boolean;
  canDeleteFiles: boolean;
};

type RouteCounters = {
  get: number;
  create: number;
  rename: number;
  delete: number;
  upload: number;
};

function makeCaseDetailsResponse(caseId: string) {
  return {
    id: '00000000-0000-4000-8000-000000001072',
    emailAddresses: ['e2e.user@example.com'],
    oids: ['00000000-0000-4000-8000-000000001073'],
    casesAccounts: [
      {
        accountId: caseId,
        caseNumber: 'CN-E2E-DOC-OPS',
        agreedToCaseTerms: true,
        isGuest: false,
        canGenerateDeclaration: true,
        canUseQA: true,
        canAccessDocuments: true,
      },
    ],
    accountId: '00000000-0000-4000-8000-000000001074',
    agreedToTerms: true,
    isActive: true,
  };
}

function makeSharePointMetadata(id: string, type: string, etag?: string) {
  return {
    id,
    uri: id,
    type,
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
    GUID: `80000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
  };
}

function makeSharePointFile(
  caseId: string,
  requestPath: string,
  name: string,
  id: number,
) {
  const pathPrefix = requestPath ? `${requestPath}/` : '';

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
    ServerRelativeUrl: `/sites/${caseId}/Shared Documents/${pathPrefix}${name}`,
    TimeCreated: nowIso,
    TimeLastModified: nowIso,
    Title: null,
    UIVersion: 1,
    UIVersionLabel: '1.0',
    UniqueId: `81000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
  };
}

function makeSharePointFolder(
  caseId: string,
  requestPath: string,
  folderName: string,
  id: number,
) {
  const pathPrefix = requestPath ? `${requestPath}/` : '';

  return {
    __metadata: makeSharePointMetadata(
      `https://example.test/folders/${id}`,
      'SP.Folder',
    ),
    Exists: true,
    ExistsAllowThrowForPolicyFailures: true,
    ExistsWithException: false,
    IsWOPIEnabled: false,
    ItemCount: 0,
    Name: folderName,
    ProgID: null,
    ServerRelativeUrl: `/sites/${caseId}/Shared Documents/${pathPrefix}${folderName}`,
    TimeCreated: nowIso,
    TimeLastModified: nowIso,
    UniqueId: `82000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    WelcomePage: '',
  };
}

function makeDocumentsResponse(
  caseId: string,
  requestPath: string,
  state: DirectoryState,
  documentAccessRole: 'CONTRIBUTOR' | 'VIEW-ONLY' = 'CONTRIBUTOR',
  documentAccess?: DocumentAccess,
) {
  return {
    d: {
      __metadata: makeSharePointMetadata(
        `https://example.test/folder/${requestPath || 'root'}`,
        'SP.Folder',
      ),
      Files: {
        results: state.files.map((name, idx) =>
          makeSharePointFile(caseId, requestPath, name, idx + 11),
        ),
      },
      Folders: {
        results: state.folders.map((name, idx) =>
          makeSharePointFolder(caseId, requestPath, name, idx + 111),
        ),
      },
      Exists: true,
      ExistsAllowThrowForPolicyFailures: true,
      ExistsWithException: false,
      IsWOPIEnabled: false,
      ItemCount: state.files.length + state.folders.length,
      Name: requestPath.split('/').at(-1) ?? 'Shared Documents',
      ProgID: null,
      ServerRelativeUrl: `/sites/${caseId}/Shared Documents/${requestPath}`,
      TimeCreated: nowIso,
      TimeLastModified: nowIso,
      UniqueId: '00000000-0000-4000-8000-000000001075',
      WelcomePage: '',
    },
    baseUrl: 'sharepoint.example.test',
    documentAccessRole,
    documentAccess,
  };
}

function normalizeDocumentsPath(pathname: string) {
  const marker = '/documents';
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex < 0) {
    return '';
  }

  let relativePath = pathname.slice(markerIndex + marker.length);
  relativePath = decodeURIComponent(relativePath)
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

  if (!relativePath || relativePath.toLowerCase() === 'root') {
    return '';
  }

  if (relativePath.toLowerCase().startsWith('root/')) {
    return relativePath.slice(5);
  }

  return relativePath;
}

function ensureDirectory(state: DocumentsState, key: string) {
  if (!state[key]) {
    state[key] = { files: [], folders: [] };
  }

  return state[key];
}

function parseJsonBody(route: Route): Record<string, unknown> | null {
  const body = route.request().postData();
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function installCommonAppRoutes(page: Page) {
  await installMockAuthRuntimeDependencies(page);

  await page.route(graphMeApi, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeMockGraphProfile()),
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

async function installDocumentsRoutes({
  page,
  caseId,
  state,
  counters,
  getUploadedFilename,
  documentAccessRole = 'CONTRIBUTOR',
  documentAccess,
}: {
  page: Page;
  caseId: string;
  state: DocumentsState;
  counters: RouteCounters;
  getUploadedFilename?: () => string | null;
  documentAccessRole?: 'CONTRIBUTOR' | 'VIEW-ONLY';
  documentAccess?: DocumentAccess;
}) {
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

  await page.route(documentsApi, async (route) => {
    const method = route.request().method();
    const url = new URL(route.request().url());
    const requestPath = normalizeDocumentsPath(url.pathname);

    if (method === 'GET') {
      counters.get += 1;
      const directory = ensureDirectory(state, requestPath);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          makeDocumentsResponse(
            caseId,
            requestPath,
            directory,
            documentAccessRole,
            documentAccess,
          ),
        ),
      });
      return;
    }

    if (method === 'POST') {
      counters.create += 1;
      const body = parseJsonBody(route);
      const folderName = String(body?.folderName ?? '').trim();
      if (folderName) {
        const directory = ensureDirectory(state, requestPath);
        if (!directory.folders.includes(folderName)) {
          directory.folders.push(folderName);
        }
        const newDirectoryPath = requestPath
          ? `${requestPath}/${folderName}`
          : folderName;
        ensureDirectory(state, newDirectoryPath);
      }

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    if (method === 'PATCH') {
      counters.rename += 1;
      const body = parseJsonBody(route);
      const folderName = String(body?.folderName ?? '').trim();
      const segments = requestPath.split('/').filter(Boolean);
      const currentName = segments.at(-1) ?? '';
      const parentPath = segments.slice(0, -1).join('/');

      if (folderName && currentName) {
        const parentDirectory = ensureDirectory(state, parentPath);
        parentDirectory.folders = parentDirectory.folders.map((name) =>
          name === currentName ? folderName : name,
        );

        const renamedPath = parentPath
          ? `${parentPath}/${folderName}`
          : folderName;
        state[renamedPath] = state[requestPath] ?? { files: [], folders: [] };
        if (renamedPath !== requestPath) {
          delete state[requestPath];
        }
      }

      await route.fulfill({ status: 204, body: '' });
      return;
    }

    if (method === 'DELETE') {
      counters.delete += 1;
      const segments = requestPath.split('/').filter(Boolean);
      const folderName = segments.at(-1) ?? '';
      const parentPath = segments.slice(0, -1).join('/');

      if (folderName) {
        const parentDirectory = ensureDirectory(state, parentPath);
        parentDirectory.folders = parentDirectory.folders.filter(
          (name) => name !== folderName,
        );
      }

      if (requestPath) {
        delete state[requestPath];
      }

      await route.fulfill({ status: 204, body: '' });
      return;
    }

    if (method === 'PUT') {
      counters.upload += 1;
      const uploadedFilename = getUploadedFilename?.();
      if (uploadedFilename) {
        const directory = ensureDirectory(state, requestPath);
        if (!directory.files.includes(uploadedFilename)) {
          directory.files.unshift(uploadedFilename);
        }
      }

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    await route.continue();
  });
}

async function openDocumentControls(page: Page) {
  await page.getByRole('button', { name: 'Folder Controls', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Folder Controls' });
  await expect(drawer.locator('[data-slot="folder-controls-panel"]')).toBeVisible();
  return drawer;
}

test.describe('Documents FolderOperations and FileDropUpload', () => {
  test.beforeEach(async ({ page }) => {
    await installCommonAppRoutes(page);
  });

  test('folder navigation refreshes files, dotted deep links reload, and query changes retain folder data', async ({ page }) => {
    const caseId = '00000000-0000-4000-8000-000000001076';
    const counters: RouteCounters = { get: 0, create: 0, rename: 0, delete: 0, upload: 0 };
    const state: DocumentsState = {
      '': { files: ['RootNote.txt'], folders: ['Correspondence.txt'] },
      'Correspondence.txt': { files: ['NestedNote.txt'], folders: [] },
    };
    await installDocumentsRoutes({ page, caseId, state, counters });
    await page.goto(`/cases/${caseId}/documents/root`);
    await expect(page.locator('table').getByRole('button', { name: 'RootNote.txt' }).first()).toBeVisible();
    const beforeNavigation = counters.get;
    await page.locator('table').getByRole('link', { name: 'Correspondence.txt' }).first().click();
    await expect(page).toHaveURL(`/cases/${caseId}/documents/root/Correspondence.txt`);
    await expect(page.locator('table').getByRole('button', { name: 'NestedNote.txt' }).first()).toBeVisible();
    await expect(page.locator('table').getByRole('button', { name: 'RootNote.txt' })).toHaveCount(0);
    expect(counters.get).toBeGreaterThan(beforeNavigation);

    const reloaded = await page.reload();
    expect(reloaded?.status()).toBe(200);
    await expect(page.locator('table').getByRole('button', { name: 'NestedNote.txt' }).first()).toBeVisible();
    const beforeQuery = counters.get;
    await page.locator('table').getByRole('button', { name: 'NestedNote.txt' }).first().click();
    await expect(page).toHaveURL(/\?file=NestedNote\.txt$/);
    await expect(page.getByRole('heading', { name: 'NestedNote.txt', exact: true })).toBeVisible();
    expect(counters.get).toBe(beforeQuery);
    await page.goBack();
    await expect(page.locator('table').getByRole('button', { name: 'NestedNote.txt' }).first()).toBeVisible();
    expect(counters.get).toBe(beforeQuery);
  });

  test('places the mobile upload area below the folder actions in the drawer', async ({ page }) => {
    const caseId = '00000000-0000-4000-8000-000000001076';
    const counters: RouteCounters = {
      get: 0,
      create: 0,
      rename: 0,
      delete: 0,
      upload: 0,
    };
    const state: DocumentsState = {
      '': { files: [], folders: [] },
    };

    await installDocumentsRoutes({ page, caseId, state, counters });
    await page.goto('/cases/' + caseId + '/documents');
    await expect(page.getByRole('button', { name: 'Upload files' })).toHaveCount(0);
    const drawer = await openDocumentControls(page);
    await expect(drawer.getByRole('button', { name: 'Upload files' })).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Explore Folder' })).toHaveCount(0);

    for (const viewport of [
      { width: 320, height: 568 },
      { width: 440, height: 956 },
      { width: 478, height: 956 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(viewport);
      const folder = await drawer.getByRole('button', { name: 'Refresh Folder' }).boundingBox();
      const upload = await drawer.getByRole('button', { name: 'Upload files' }).boundingBox();
      expect(upload!.y).toBeGreaterThanOrEqual(folder!.y + folder!.height);
      await expect.poll(async () => {
        const box = await drawer.getByRole('button', { name: 'Upload files' }).boundingBox();
        return box ? box.x + box.width : Infinity;
      }).toBeLessThanOrEqual(viewport.width);
    }
    await drawer.getByRole('button', { name: 'Close Folder Controls' }).click();
    await expect(drawer.locator('[data-slot="folder-controls-panel"]')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Folder Controls' })).toBeVisible();

    const reopenedDrawer = await openDocumentControls(page);
    const requestsBeforeRefresh = counters.get;
    await reopenedDrawer.getByRole('button', { name: 'Refresh Folder' }).click();
    await expect.poll(() => counters.get).toBeGreaterThan(requestsBeforeRefresh);
  });

  test('creates a folder from FolderOperations and refreshes the file list', async ({
    page,
  }) => {
    const caseId = '00000000-0000-4000-8000-000000001076';
    const counters: RouteCounters = {
      get: 0,
      create: 0,
      rename: 0,
      delete: 0,
      upload: 0,
    };
    const state: DocumentsState = {
      '': {
        files: ['RootNote.txt'],
        folders: ['Evidence'],
      },
      Evidence: {
        files: ['Complaint.pdf'],
        folders: [],
      },
    };

    await installDocumentsRoutes({ page, caseId, state, counters });

    await page.goto('/cases/' + caseId + '/documents/root/Evidence');
    await expect(
      page
        .locator('table')
        .getByRole('button', { name: 'Complaint.pdf' })
        .first(),
    ).toBeVisible();

    const drawer = await openDocumentControls(page);
    const actionColors = await Promise.all(
      ['Create New Folder', 'Rename Folder', 'Refresh Folder', 'Delete Folder'].map(
        (name) => drawer.getByRole('button', { name }).evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        ),
      ),
    );
    expect(new Set(actionColors).size).toBe(4);
    await page.getByRole('button', { name: 'Create New Folder' }).click();

    const dialog = page.getByRole('dialog', { name: 'Create New Folder' });
    await expect(
      dialog.getByRole('heading', { name: 'Create New Folder' }),
    ).toBeVisible();

    const createdFolder = 'Depositions';
    await dialog.getByPlaceholder('Folder Name').fill(createdFolder);
    await dialog.getByRole('button', { name: 'Submit' }).click();

    await expect.poll(() => counters.create).toBe(1);
    await expect(
      page.locator('table').getByRole('link', { name: createdFolder }).first(),
    ).toBeVisible();
  });

  test('renames a folder from FolderOperations and navigates to the new path', async ({
    page,
  }) => {
    const caseId = '00000000-0000-4000-8000-000000001077';
    const counters: RouteCounters = {
      get: 0,
      create: 0,
      rename: 0,
      delete: 0,
      upload: 0,
    };
    const state: DocumentsState = {
      '': {
        files: ['RootNote.txt'],
        folders: ['Evidence'],
      },
      Evidence: {
        files: ['Complaint.pdf'],
        folders: [],
      },
    };

    await installDocumentsRoutes({ page, caseId, state, counters });

    await page.goto(`/cases/${caseId}/documents/root/Evidence`);

    await openDocumentControls(page);
    await page.getByRole('button', { name: 'Rename Folder' }).click();

    const dialog = page.getByRole('dialog', { name: 'Rename Folder' });
    await expect(
      dialog.getByRole('heading', { name: 'Rename Folder' }),
    ).toBeVisible();

    const renamedFolder = 'Evidence-Renamed';
    await dialog.getByPlaceholder('New Folder Name').fill(renamedFolder);
    await dialog.getByRole('button', { name: 'Submit' }).click();

    await expect.poll(() => counters.rename).toBe(1);
    await page.waitForURL(`/cases/${caseId}/documents/root/${renamedFolder}`);

    const reopenedDrawer = await openDocumentControls(page);
    await reopenedDrawer.getByRole('button', { name: 'Rename Folder' }).click();
    await expect(
      page
        .getByRole('dialog', { name: 'Rename Folder' })
        .getByRole('heading', { name: 'Rename Folder' }),
    ).toBeVisible();
  });

  test('can reopen rename after a failed request', async ({ page }) => {
    const caseId = '00000000-0000-4000-8000-000000001078';
    const counters: RouteCounters = {
      get: 0,
      create: 0,
      rename: 0,
      delete: 0,
      upload: 0,
    };
    const state: DocumentsState = {
      '': { files: [], folders: ['Evidence'] },
      Evidence: { files: [], folders: [] },
    };

    await installDocumentsRoutes({ page, caseId, state, counters });
    let failedRename = false;
    await page.route(documentsApi, async (route) => {
      if (route.request().method() === 'PATCH' && !failedRename) {
        failedRename = true;
        await route.fulfill({ status: 500, body: 'Rename failed' });
        return;
      }
      await route.fallback();
    });

    await page.goto(`/cases/${caseId}/documents/root/Evidence`);
    const drawer = await openDocumentControls(page);
    await drawer.getByRole('button', { name: 'Rename Folder' }).click();
    const dialog = page.getByRole('dialog', { name: 'Rename Folder' });
    await dialog.getByPlaceholder('New Folder Name').fill('Evidence-Renamed');
    await dialog.getByRole('button', { name: 'Submit' }).click();
    await expect.poll(() => failedRename).toBe(true);
    await expect(page.getByPlaceholder('New Folder Name')).toHaveCount(0);

    await drawer.getByRole('button', { name: 'Close Folder Controls' }).click();
    const reopenedDrawer = await openDocumentControls(page);
    await reopenedDrawer.getByRole('button', { name: 'Rename Folder' }).click();
    const reopenedDialog = page.getByRole('dialog', { name: 'Rename Folder' });
    await expect(
      reopenedDialog.getByRole('heading', { name: 'Rename Folder' }),
    ).toBeVisible();
    await reopenedDialog.getByPlaceholder('New Folder Name').fill('Evidence-Renamed');
    await reopenedDialog.getByRole('button', { name: 'Submit' }).click();
    await expect.poll(() => counters.rename).toBe(1);
    await page.waitForURL(`/cases/${caseId}/documents/root/Evidence-Renamed`);
  });

  test('deletes a folder from FolderOperations and navigates to parent path', async ({
    page,
  }) => {
    const caseId = '00000000-0000-4000-8000-000000001079';
    const counters: RouteCounters = {
      get: 0,
      create: 0,
      rename: 0,
      delete: 0,
      upload: 0,
    };
    const state: DocumentsState = {
      '': {
        files: ['RootNote.txt'],
        folders: ['Evidence'],
      },
      Evidence: {
        files: ['Complaint.pdf'],
        folders: ['Exhibits'],
      },
      'Evidence/Exhibits': {
        files: ['Exhibit-A.pdf'],
        folders: [],
      },
    };

    await installDocumentsRoutes({ page, caseId, state, counters });

    await page.goto('/cases/' + caseId + '/documents/root/Evidence/Exhibits');
    await expect(
      page
        .locator('table')
        .getByRole('button', { name: 'Exhibit-A.pdf' })
        .first(),
    ).toBeVisible();

    await openDocumentControls(page);
    await page.getByRole('button', { name: 'Delete Folder' }).click();

    const dialog = page.getByRole('dialog', { name: 'Delete Folder' });
    await expect(
      dialog.getByRole('heading', { name: 'Delete Folder' }),
    ).toBeVisible();

    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect.poll(() => counters.delete).toBe(1);
    await expect(page).toHaveURL(
      '/cases/' + caseId + '/documents/root/Evidence',
    );
    await expect(
      page.locator('table').getByRole('link', { name: 'Exhibits' }),
    ).toHaveCount(0);
  });

  test('uploads a file with FileDropUpload and refreshes the file list', async ({
    page,
  }) => {
    const caseId = '00000000-0000-4000-8000-000000001080';
    const counters: RouteCounters = {
      get: 0,
      create: 0,
      rename: 0,
      delete: 0,
      upload: 0,
    };
    const state: DocumentsState = {
      '': {
        files: ['RootNote.txt'],
        folders: ['Evidence'],
      },
      Evidence: {
        files: ['Complaint.pdf'],
        folders: [],
      },
    };

    const uploadedFilename = 'Uploaded-Client-Note.pdf';

    await installDocumentsRoutes({
      page,
      caseId,
      state,
      counters,
      getUploadedFilename: () => uploadedFilename,
    });

    await page.goto('/cases/' + caseId + '/documents/root/Evidence');
    await openDocumentControls(page);
    await expect(page.locator('input[type="file"]')).toHaveCount(1);
    const acceptedTypes = page.getByText(/^Accepted:/);
    await expect(acceptedTypes).toBeVisible();
    expect(
      await acceptedTypes.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);

    await page.locator('input[type="file"]').setInputFiles({
      name: uploadedFilename,
      mimeType: 'application/pdf',
      buffer: Buffer.from('fake file content', 'utf-8'),
    });

    await expect.poll(() => counters.upload).toBe(1);
    await expect.poll(() => counters.get).toBeGreaterThan(1);
    await expect(
      page
        .locator('table')
        .getByRole('button', { name: uploadedFilename })
        .first(),
    ).toBeVisible();
  });
  test('shows create and upload at the root folder when SharePoint grants add permission', async ({
    page,
  }) => {
    const caseId = '00000000-0000-4000-8000-000000001084';
    const counters: RouteCounters = {
      get: 0,
      create: 0,
      rename: 0,
      delete: 0,
      upload: 0,
    };
    const state: DocumentsState = {
      '': {
        files: ['RootNote.txt'],
        folders: ['Evidence'],
      },
    };

    await installDocumentsRoutes({
      page,
      caseId,
      state,
      counters,
      documentAccess: {
        role: 'CONTRIBUTOR',
        canCreateFolders: true,
        canRenameFolders: true,
        canDeleteFolders: true,
        canUploadFiles: true,
        canDeleteFiles: true,
      },
    });

    const rootRequest = page.waitForRequest(
      (request) =>
        request.method() === 'GET' &&
        request.url().includes(`/api/accounts/cases/${caseId}/documents`),
    );
    await page.goto('/cases/' + caseId + '/documents/root');
    expect(new URL((await rootRequest).url()).pathname).toBe(
      `/api/accounts/cases/${caseId}/documents`,
    );
    await expect(
      page
        .locator('table')
        .getByRole('button', { name: 'RootNote.txt' })
        .first(),
    ).toBeVisible();
    await openDocumentControls(page);
    await expect(page.locator('input[type="file"]')).toHaveCount(1);

    await expect(
      page.getByRole('button', { name: 'Create New Folder' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Rename Folder' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Delete Folder' }),
    ).toHaveCount(0);
  });

  test('shows a root folder request failure instead of loading indefinitely', async ({
    page,
  }) => {
    const caseId = '00000000-0000-4000-8000-000000001085';
    const counters: RouteCounters = {
      get: 0,
      create: 0,
      rename: 0,
      delete: 0,
      upload: 0,
    };

    await installDocumentsRoutes({ page, caseId, state: {}, counters });
    await page.route(
      `**/api/accounts/cases/${caseId}/documents`,
      (route) =>
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'SharePoint API error' }),
        }),
    );

    await page.goto(`/cases/${caseId}/documents/root`);
    await expect(page.getByText('SharePoint API error (404)')).toBeVisible();
  });

  test('hides create and upload when SharePoint denies add permission', async ({
    page,
  }) => {
    const caseId = '00000000-0000-4000-8000-000000001083';
    const counters: RouteCounters = {
      get: 0,
      create: 0,
      rename: 0,
      delete: 0,
      upload: 0,
    };
    const state: DocumentsState = {
      '': {
        files: ['RootNote.txt'],
        folders: ['Evidence'],
      },
      Evidence: {
        files: ['Complaint.pdf'],
        folders: ['Exhibits'],
      },
    };

    await installDocumentsRoutes({
      page,
      caseId,
      state,
      counters,
      documentAccess: {
        role: 'CONTRIBUTOR',
        canCreateFolders: false,
        canRenameFolders: true,
        canDeleteFolders: true,
        canUploadFiles: false,
        canDeleteFiles: true,
      },
    });

    await page.goto('/cases/' + caseId + '/documents/root/Evidence');
    await expect(
      page
        .locator('table')
        .getByRole('button', { name: 'Complaint.pdf' })
        .first(),
    ).toBeVisible();
    await openDocumentControls(page);
    await expect(page.locator('input[type="file"]')).toHaveCount(0);

    await expect(
      page.getByRole('button', { name: 'Create New Folder' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Rename Folder' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Delete Folder' }),
    ).toBeVisible();
    expect(counters.create).toBe(0);
    expect(counters.upload).toBe(0);
  });

  test('limits folder operations and upload for SharePoint Viewer role', async ({
    page,
  }) => {
    const caseId = '00000000-0000-4000-8000-000000001081';
    const counters: RouteCounters = {
      get: 0,
      create: 0,
      rename: 0,
      delete: 0,
      upload: 0,
    };
    const state: DocumentsState = {
      '': {
        files: ['RootNote.txt'],
        folders: ['Evidence'],
      },
      Evidence: {
        files: ['Complaint.pdf'],
        folders: ['Exhibits'],
      },
    };

    await installDocumentsRoutes({
      page,
      caseId,
      state,
      counters,
      documentAccessRole: 'VIEW-ONLY',
    });

    await page.goto('/cases/' + caseId + '/documents/root/Evidence');
    await expect(
      page
        .locator('table')
        .getByRole('button', { name: 'Complaint.pdf' })
        .first(),
    ).toBeVisible();
    await openDocumentControls(page);
    await expect(page.locator('input[type="file"]')).toHaveCount(0);

    await expect(
      page.getByRole('button', { name: 'Create New Folder' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Rename Folder' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Delete Folder' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Refresh Folder' }),
    ).toBeVisible();

    expect(counters.create).toBe(0);
    expect(counters.rename).toBe(0);
    expect(counters.delete).toBe(0);
    expect(counters.upload).toBe(0);
  });
});
