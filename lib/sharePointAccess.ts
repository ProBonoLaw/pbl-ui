export const DOCUMENT_ACCESS_ROLE_VALUES = [
  'CONTRIBUTOR',
  'VIEW-ONLY',
] as const;

export type DocumentAccessRole = (typeof DOCUMENT_ACCESS_ROLE_VALUES)[number];

export const DEFAULT_DOCUMENT_ACCESS_ROLE: DocumentAccessRole = 'CONTRIBUTOR';

export const DOCUMENT_ACCESS_ROLE_OPTIONS = [
  {
    value: 'CONTRIBUTOR',
    label: 'Contributor',
    description: 'Can view, upload, edit, and delete case documents.',
  },
  {
    value: 'VIEW-ONLY',
    label: 'Viewer',
    description: 'Can view and download case documents.',
  },
] satisfies {
  value: DocumentAccessRole;
  label: string;
  description: string;
}[];

export function isDocumentAccessRole(
  value: unknown,
): value is DocumentAccessRole {
  return (
    typeof value === 'string' &&
    DOCUMENT_ACCESS_ROLE_VALUES.includes(value as DocumentAccessRole)
  );
}

export function normalizeDocumentAccessRole(
  value: unknown,
): DocumentAccessRole {
  return isDocumentAccessRole(value) ? value : DEFAULT_DOCUMENT_ACCESS_ROLE;
}

export function getDocumentAccessRoleLabel(
  value: unknown,
  canAccessDocuments?: boolean,
) {
  if (canAccessDocuments !== true) {
    return 'No';
  }

  const role = normalizeDocumentAccessRole(value);
  return (
    DOCUMENT_ACCESS_ROLE_OPTIONS.find((option) => option.value === role)
      ?.label ?? 'Contributor'
  );
}

export function getSharePointReadScopes(
  sharePointHost: string,
  configuredScopes?: string | null,
) {
  const scopes = (configuredScopes ?? '')
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);

  return scopes.length > 0
    ? scopes
    : ['https://' + sharePointHost + '/AllSites.Read'];
}

export type SharePointEffectiveBasePermissions = {
  High?: string | number;
  Low?: string | number;
};

export type SharePointDocumentAccessRole = DocumentAccessRole;

export type SharePointDocumentAccess = {
  role: SharePointDocumentAccessRole;
  canCreateFolders: boolean;
  canRenameFolders: boolean;
  canDeleteFolders: boolean;
  canUploadFiles: boolean;
  canDeleteFiles: boolean;
};

const SHAREPOINT_LIST_ITEM_WRITE_PERMISSIONS = {
  addListItems: 0x2n,
  editListItems: 0x4n,
  deleteListItems: 0x8n,
};

export const DEFAULT_SHAREPOINT_DOCUMENT_ACCESS: SharePointDocumentAccess = {
  role: 'VIEW-ONLY',
  canCreateFolders: false,
  canRenameFolders: false,
  canDeleteFolders: false,
  canUploadFiles: false,
  canDeleteFiles: false,
};

function parseSharePointPermissionValue(value: string | number | undefined) {
  if (value === undefined) {
    return 0n;
  }

  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

export function extractEffectiveBasePermissions(
  data: unknown,
): SharePointEffectiveBasePermissions | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const root = data as Record<string, unknown>;
  const d = root.d && typeof root.d === 'object' ? root.d : root;
  const record = d as Record<string, unknown>;
  const permissions =
    record.EffectiveBasePermissions &&
    typeof record.EffectiveBasePermissions === 'object'
      ? record.EffectiveBasePermissions
      : record;
  const permissionRecord = permissions as Record<string, unknown>;

  if (
    permissionRecord.Low === undefined &&
    permissionRecord.High === undefined
  ) {
    return null;
  }

  return {
    High:
      typeof permissionRecord.High === 'string' ||
      typeof permissionRecord.High === 'number'
        ? permissionRecord.High
        : undefined,
    Low:
      typeof permissionRecord.Low === 'string' ||
      typeof permissionRecord.Low === 'number'
        ? permissionRecord.Low
        : undefined,
  };
}

export function getDocumentAccessFromPermissions(
  permissions: SharePointEffectiveBasePermissions | null,
): SharePointDocumentAccess {
  if (!permissions) {
    return DEFAULT_SHAREPOINT_DOCUMENT_ACCESS;
  }

  const low = parseSharePointPermissionValue(permissions.Low);
  const canAddListItems =
    (low & SHAREPOINT_LIST_ITEM_WRITE_PERMISSIONS.addListItems) ===
    SHAREPOINT_LIST_ITEM_WRITE_PERMISSIONS.addListItems;
  const canEditListItems =
    (low & SHAREPOINT_LIST_ITEM_WRITE_PERMISSIONS.editListItems) ===
    SHAREPOINT_LIST_ITEM_WRITE_PERMISSIONS.editListItems;
  const canDeleteListItems =
    (low & SHAREPOINT_LIST_ITEM_WRITE_PERMISSIONS.deleteListItems) ===
    SHAREPOINT_LIST_ITEM_WRITE_PERMISSIONS.deleteListItems;
  const canWriteDocuments =
    canAddListItems || canEditListItems || canDeleteListItems;

  return {
    role: canWriteDocuments ? 'CONTRIBUTOR' : 'VIEW-ONLY',
    canCreateFolders: canAddListItems,
    canRenameFolders: canEditListItems,
    canDeleteFolders: canDeleteListItems,
    canUploadFiles: canAddListItems,
    canDeleteFiles: canDeleteListItems,
  };
}

function escapeSharePointODataString(value: string) {
  return value.replace(/'/g, "''");
}

function getSharePointDocumentRelativePath(path?: string[]) {
  return path?.filter(Boolean).join('/') ?? '';
}

export function getSharePointDocumentServerRelativeUrl(
  caseId: string,
  path?: string[],
) {
  const relativePath = getSharePointDocumentRelativePath(path);

  return relativePath
    ? `/sites/${caseId}/Shared Documents/${relativePath}`
    : `/sites/${caseId}/Shared Documents/`;
}

export function getSharePointFolderContentsUrl(
  sharePointHost: string,
  caseId: string,
  path?: string[],
) {
  const serverRelativeUrl = getSharePointDocumentServerRelativeUrl(caseId, path)
    .replace(/\/$/, '')
    .replace(/'/g, "''")
    .split('/')
    .map(encodeURIComponent)
    .join('/');

  return (
    `https://${sharePointHost}/sites/${caseId}` +
    `/_api/web/GetFolderByServerRelativePath(decodedurl='${serverRelativeUrl}')` +
    '?$expand=Files,Folders,Folders/ListItemAllFields,Files/ListItemAllFields'
  );
}

export function getSharePointDefaultLibraryContentsUrl(
  sharePointHost: string,
  caseId: string,
) {
  return (
    `https://${sharePointHost}/sites/${caseId}` +
    "/_api/web/lists/getbytitle('Documents')/RootFolder" +
    '?$expand=Files,Folders,Folders/ListItemAllFields,Files/ListItemAllFields'
  );
}

export function isSharedDocumentsRoot(
  caseId: string,
  serverRelativeUrl: unknown,
) {
  if (typeof serverRelativeUrl !== 'string') {
    return false;
  }

  const expectedRoot = getSharePointDocumentServerRelativeUrl(caseId)
    .replace(/\/$/, '')
    .toLowerCase();
  const actualRoot = serverRelativeUrl
    .replace(/\/$/, '')
    .replace(/%20/gi, ' ')
    .toLowerCase();

  return actualRoot === expectedRoot;
}

export function getSharePointDocumentPermissionsUrl(
  sharePointHost: string,
  caseId: string,
  path?: string[],
) {
  const relativePath = getSharePointDocumentRelativePath(path);
  const serverRelativeUrl = escapeSharePointODataString(
    getSharePointDocumentServerRelativeUrl(caseId, path),
  );

  if (!relativePath) {
    return (
      `https://${sharePointHost}/sites/${caseId}` +
      `/_api/web/GetList('${serverRelativeUrl}')/EffectiveBasePermissions`
    );
  }

  return (
    `https://${sharePointHost}/sites/${caseId}` +
    `/_api/web/GetFolderByServerRelativePath(decodedurl='${serverRelativeUrl}')` +
    '/ListItemAllFields/EffectiveBasePermissions'
  );
}

export function getSharePointGrantAccessLevel(input: {
  canAccessDocuments?: boolean;
  documentAccessRole?: unknown;
}) {
  if (input.canAccessDocuments !== true) {
    return undefined;
  }

  return normalizeDocumentAccessRole(input.documentAccessRole);
}

export function getSharePointAccessEventAction(input: {
  previousCanAccessDocuments?: boolean;
  nextCanAccessDocuments?: boolean;
}) {
  if (input.nextCanAccessDocuments === true) {
    return 'grant' as const;
  }

  if (
    input.previousCanAccessDocuments === true &&
    input.nextCanAccessDocuments === false
  ) {
    return 'revoke' as const;
  }

  return undefined;
}
