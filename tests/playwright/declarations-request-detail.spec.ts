import { expect, Page, test } from '@playwright/test';
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
const declarationRequestApi =
  /\/api\/accounts\/cases\/[0-9a-fA-F-]{36}\/requests\/[0-9a-fA-F-]{36}$/;
const generatedDocumentsFolderApi =
  /\/api\/accounts\/cases\/[0-9a-fA-F-]{36}\/documents\/_GeneratedDocuments\/[0-9a-fA-F-]{36}$/;
const generatedDocumentFileApi =
  /\/api\/accounts\/cases\/[0-9a-fA-F-]{36}\/documents\/_GeneratedDocuments\/[0-9a-fA-F-]{36}\/.+\?isFile=true$/;

const nowIso = '2026-01-01T00:00:00.000Z';

type RequestContentFixture = {
  name: string;
  fileId: string;
  sourceUrl?: string | null;
  pages?: string | null;
};

function makeCaseDetailsResponse(caseId: string) {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    emailAddresses: ['e2e.user@example.com'],
    oids: ['10000000-0000-4000-8000-000000000002'],
    casesAccounts: [
      {
        accountId: caseId,
        caseNumber: 'CN-E2E-DECLARATION',
        agreedToCaseTerms: true,
        isGuest: false,
        canGenerateDeclaration: true,
        canUseQA: true,
        canAccessDocuments: true,
      },
    ],
    accountId: '10000000-0000-4000-8000-000000000003',
    agreedToTerms: true,
    isActive: true,
  };
}

function makeRequestDetailsResponse(
  caseId: string,
  requestId: string,
  declarationId: string,
  input: string,
  contents: RequestContentFixture[],
) {
  return {
    id: requestId,
    accountId: caseId,
    sessionId: '10000000-0000-4000-8000-000000000004',
    input,
    type: 'declaration',
    status: 'generated',
    oid: '10000000-0000-4000-8000-000000000005',
    startedAt: nowIso,
    endedAt: nowIso,
    contents,
    sourceUrl: `https://example.test/sites/${caseId}/Shared%20Documents/_GeneratedDocuments/${declarationId}/Declaration.md`,
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
    GUID: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
  };
}

function makeSharePointFile(
  caseId: string,
  declarationId: string,
  name: string,
  id: number,
) {
  return {
    __metadata: makeSharePointMetadata(
      `https://example.test/files/${id}`,
      'SP.File',
      '\"1\"',
    ),
    ListItemAllFields: makeListItemAllFields(id),
    CheckInComment: '',
    CheckOutType: 0,
    ContentTag: 'content-tag',
    CustomizedPageStatus: 0,
    ETag: '\"1\"',
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
    ServerRelativeUrl: `/sites/${caseId}/Shared Documents/_GeneratedDocuments/${declarationId}/${name}`,
    TimeCreated: nowIso,
    TimeLastModified: nowIso,
    Title: null,
    UIVersion: 1,
    UIVersionLabel: '1.0',
    UniqueId: `20000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
  };
}

function makeGeneratedDocumentsFolderResponse(
  caseId: string,
  declarationId: string,
) {
  return {
    d: {
      __metadata: makeSharePointMetadata(
        `https://example.test/folder/${declarationId}`,
        'SP.Folder',
      ),
      Files: {
        results: [
          makeSharePointFile(caseId, declarationId, 'Declaration.md', 11),
          makeSharePointFile(caseId, declarationId, 'Exhibit 2.pdf', 12),
          makeSharePointFile(caseId, declarationId, 'Exhibit 10.pdf', 13),
        ],
      },
      Folders: {
        results: [],
      },
      Exists: true,
      ExistsAllowThrowForPolicyFailures: true,
      ExistsWithException: false,
      IsWOPIEnabled: false,
      ItemCount: 3,
      Name: '_GeneratedDocuments',
      ProgID: null,
      ServerRelativeUrl: `/sites/${caseId}/Shared Documents/_GeneratedDocuments/${declarationId}`,
      TimeCreated: nowIso,
      TimeLastModified: nowIso,
      UniqueId: '00000000-0000-4000-8000-000000001002',
      WelcomePage: '',
    },
    baseUrl: 'sharepoint.example.test',
  };
}

function makeGeneratedFileResponse(
  caseId: string,
  declarationId: string,
  filename: string,
  content: string,
) {
  return {
    d: makeSharePointFile(caseId, declarationId, filename, 21),
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

test.describe('Declaration request detail page', () => {
  test.beforeEach(async ({ page }) => {
    await installCommonAppRoutes(page);
  });

  test('renders request text, declaration markdown, sorted exhibits, and downloads docx', async ({
    page,
  }) => {
    const caseId = '00000000-0000-4000-8000-000000001005';
    const requestId = '00000000-0000-4000-8000-000000001006';
    const declarationId = '00000000-0000-4000-8000-000000001007';
    const requestText = 'Prepare declaration for hearing next week.';
    const declarationMarkdown =
      '# Final Declaration\n\nThis is the generated declaration body.';

    let declarationDocxFetches = 0;

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

    await page.route(declarationRequestApi, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          makeRequestDetailsResponse(
            caseId,
            requestId,
            declarationId,
            requestText,
            [
              {
                name: 'Exhibit 10.pdf',
                fileId: 'f-10',
                sourceUrl: 'https://example.test/source/10',
                pages: '10-12',
              },
              {
                name: 'Exhibit 2.pdf',
                fileId: 'f-2',
                sourceUrl: 'https://example.test/source/2',
                pages: '2-3',
              },
            ],
          ),
        ),
      });
    });

    await page.route(generatedDocumentsFolderApi, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          makeGeneratedDocumentsFolderResponse(caseId, declarationId),
        ),
      });
    });

    await page.route(generatedDocumentFileApi, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      const url = new URL(route.request().url());
      const filename = decodeURIComponent(url.pathname.split('/').at(-1) ?? '');

      if (filename === 'Declaration.md') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            makeGeneratedFileResponse(
              caseId,
              declarationId,
              filename,
              declarationMarkdown,
            ),
          ),
        });
        return;
      }

      if (filename === 'Declaration.docx') {
        declarationDocxFetches += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            makeGeneratedFileResponse(
              caseId,
              declarationId,
              filename,
              'docx binary content',
            ),
          ),
        });
        return;
      }

      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unknown file' }),
      });
    });

    await page.goto(`/cases/${caseId}/declarations/${requestId}`);

    await expect(
      page.getByRole('note', { name: 'AI output warning' }),
    ).toHaveText(
      'AI-generated. May be inaccurate. Verify before relying on outputs.',
    );

    await expect(
      page.getByRole('heading', { name: 'Declaration', exact: true }),
    ).toBeVisible();
    await expect(page.getByText(requestText)).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Final Declaration' }),
    ).toBeVisible();

    const exhibitButtons = page.locator('div.border.p-4.my-2 > button');
    await expect(exhibitButtons).toHaveCount(2);
    await expect(exhibitButtons.nth(0)).toHaveText('Exhibit 2.pdf');
    await expect(exhibitButtons.nth(1)).toHaveText('Exhibit 10.pdf');

    await page.getByRole('button', { name: 'Download' }).click();
    await expect.poll(() => declarationDocxFetches).toBe(1);
  });

  test('shows a no-exhibits message when request contents are empty', async ({
    page,
  }) => {
    const caseId = '00000000-0000-4000-8000-000000001009';
    const requestId = '00000000-0000-4000-8000-000000001010';
    const declarationId = '00000000-0000-4000-8000-000000001011';

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

    await page.route(declarationRequestApi, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          makeRequestDetailsResponse(
            caseId,
            requestId,
            declarationId,
            'No exhibits needed for this request.',
            [],
          ),
        ),
      });
    });

    await page.route(generatedDocumentsFolderApi, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          makeGeneratedDocumentsFolderResponse(caseId, declarationId),
        ),
      });
    });

    await page.route(generatedDocumentFileApi, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      const url = new URL(route.request().url());
      const filename = decodeURIComponent(url.pathname.split('/').at(-1) ?? '');

      if (filename === 'Declaration.md') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            makeGeneratedFileResponse(
              caseId,
              declarationId,
              filename,
              '# Declaration without exhibits',
            ),
          ),
        });
        return;
      }

      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unknown file' }),
      });
    });

    await page.goto(`/cases/${caseId}/declarations/${requestId}`);

    await expect(
      page.getByRole('heading', { name: 'Declaration', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('No exhibits found.')).toBeVisible();
    await expect(page.locator('div.border.p-4.my-2 > button')).toHaveCount(0);
  });
});
