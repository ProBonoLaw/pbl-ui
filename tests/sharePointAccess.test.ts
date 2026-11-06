import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getDocumentAccessFromPermissions,
  getDocumentAccessRoleLabel,
  getSharePointAccessEventAction,
  getSharePointDocumentPermissionsUrl,
  getSharePointDocumentServerRelativeUrl,
  getSharePointDefaultLibraryContentsUrl,
  getSharePointFolderContentsUrl,
  getSharePointGrantAccessLevel,
  getSharePointReadScopes,
  isSharedDocumentsRoot,
  normalizeDocumentAccessRole,
} from '../lib/sharePointAccess.ts';

test('normalizes document access roles for the sharing UI', () => {
  assert.equal(normalizeDocumentAccessRole('CONTRIBUTOR'), 'CONTRIBUTOR');
  assert.equal(normalizeDocumentAccessRole('VIEW-ONLY'), 'VIEW-ONLY');
  assert.equal(normalizeDocumentAccessRole('USER'), 'CONTRIBUTOR');
  assert.equal(normalizeDocumentAccessRole(undefined), 'CONTRIBUTOR');
});

test('builds read-only SharePoint scopes for document listing', () => {
  assert.deepEqual(getSharePointReadScopes('contoso.sharepoint.com'), [
    'https://contoso.sharepoint.com/AllSites.Read',
  ]);
  assert.deepEqual(
    getSharePointReadScopes(
      'contoso.sharepoint.com',
      ' https://contoso.sharepoint.com/AllSites.Read , https://contoso.sharepoint.com/Sites.Search.All ',
    ),
    [
      'https://contoso.sharepoint.com/AllSites.Read',
      'https://contoso.sharepoint.com/Sites.Search.All',
    ],
  );
});

test('builds root and folder SharePoint permission URLs', () => {
  const caseId = '00000000-0000-4000-8000-000000001102';

  assert.equal(
    getSharePointDocumentServerRelativeUrl(caseId),
    '/sites/00000000-0000-4000-8000-000000001102/Shared Documents/',
  );
  assert.equal(
    getSharePointDocumentPermissionsUrl('contoso.sharepoint.com', caseId),
    "https://contoso.sharepoint.com/sites/00000000-0000-4000-8000-000000001102/_api/web/GetList('/sites/00000000-0000-4000-8000-000000001102/Shared Documents/')/EffectiveBasePermissions",
  );
  assert.equal(
    getSharePointDocumentPermissionsUrl('contoso.sharepoint.com', caseId, [
      'Evidence',
      'Client Uploads',
    ]),
    "https://contoso.sharepoint.com/sites/00000000-0000-4000-8000-000000001102/_api/web/GetFolderByServerRelativePath(decodedurl='/sites/00000000-0000-4000-8000-000000001102/Shared Documents/Evidence/Client Uploads')/ListItemAllFields/EffectiveBasePermissions",
  );
});

test('builds server-relative SharePoint folder listing URLs', () => {
  const caseId = '00000000-0000-4000-8000-000000001102';

  assert.equal(
    getSharePointFolderContentsUrl('contoso.sharepoint.com', caseId),
    "https://contoso.sharepoint.com/sites/00000000-0000-4000-8000-000000001102/_api/web/GetFolderByServerRelativePath(decodedurl='/sites/00000000-0000-4000-8000-000000001102/Shared%20Documents')?$expand=Files,Folders,Folders/ListItemAllFields,Files/ListItemAllFields",
  );
  assert.equal(
    getSharePointDefaultLibraryContentsUrl('contoso.sharepoint.com', caseId),
    "https://contoso.sharepoint.com/sites/00000000-0000-4000-8000-000000001102/_api/web/lists/getbytitle('Documents')/RootFolder?$expand=Files,Folders,Folders/ListItemAllFields,Files/ListItemAllFields",
  );
  assert.equal(
    getSharePointFolderContentsUrl('contoso.sharepoint.com', caseId, [
      'Evidence',
      'Client #1',
    ]),
    "https://contoso.sharepoint.com/sites/00000000-0000-4000-8000-000000001102/_api/web/GetFolderByServerRelativePath(decodedurl='/sites/00000000-0000-4000-8000-000000001102/Shared%20Documents/Evidence/Client%20%231')?$expand=Files,Folders,Folders/ListItemAllFields,Files/ListItemAllFields",
  );
});

test('accepts only the Shared Documents library as the case root', () => {
  const caseId = '00000000-0000-4000-8000-000000001102';

  assert.equal(
    isSharedDocumentsRoot(
      caseId,
      `/sites/${caseId}/Shared%20Documents/`,
    ),
    true,
  );
  assert.equal(
    isSharedDocumentsRoot(caseId, `/sites/${caseId}/Other Documents`),
    false,
  );
});

test('maps SharePoint effective permissions to document operations', () => {
  assert.deepEqual(getDocumentAccessFromPermissions({ Low: '14', High: '0' }), {
    role: 'CONTRIBUTOR',
    canCreateFolders: true,
    canRenameFolders: true,
    canDeleteFolders: true,
    canUploadFiles: true,
    canDeleteFiles: true,
  });
  assert.deepEqual(getDocumentAccessFromPermissions({ Low: '0', High: '0' }), {
    role: 'VIEW-ONLY',
    canCreateFolders: false,
    canRenameFolders: false,
    canDeleteFolders: false,
    canUploadFiles: false,
    canDeleteFiles: false,
  });
});

test('maps visible document roles to SharePoint grant access levels', () => {
  assert.equal(
    getSharePointGrantAccessLevel({
      canAccessDocuments: true,
      documentAccessRole: 'CONTRIBUTOR',
    }),
    'CONTRIBUTOR',
  );
  assert.equal(
    getSharePointGrantAccessLevel({
      canAccessDocuments: true,
      documentAccessRole: 'VIEW-ONLY',
    }),
    'VIEW-ONLY',
  );
  assert.equal(
    getSharePointGrantAccessLevel({
      canAccessDocuments: false,
      documentAccessRole: 'VIEW-ONLY',
    }),
    undefined,
  );
});

test('chooses SharePoint access event actions', () => {
  assert.equal(
    getSharePointAccessEventAction({
      previousCanAccessDocuments: false,
      nextCanAccessDocuments: true,
    }),
    'grant',
  );
  assert.equal(
    getSharePointAccessEventAction({
      previousCanAccessDocuments: true,
      nextCanAccessDocuments: false,
    }),
    'revoke',
  );
  assert.equal(
    getSharePointAccessEventAction({
      previousCanAccessDocuments: false,
      nextCanAccessDocuments: false,
    }),
    undefined,
  );
});

test('renders document access labels for sharing tables', () => {
  assert.equal(getDocumentAccessRoleLabel('CONTRIBUTOR', true), 'Contributor');
  assert.equal(getDocumentAccessRoleLabel('VIEW-ONLY', true), 'Viewer');
  assert.equal(getDocumentAccessRoleLabel(undefined, false), 'No');
  assert.equal(getDocumentAccessRoleLabel(undefined), 'No');
});
