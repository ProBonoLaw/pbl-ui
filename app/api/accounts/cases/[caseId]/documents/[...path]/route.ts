import { logger } from '@/lib/logger';
import {
  DEFAULT_SHAREPOINT_DOCUMENT_ACCESS,
  extractEffectiveBasePermissions,
  getDocumentAccessFromPermissions,
  getSharePointDefaultLibraryContentsUrl,
  getSharePointFolderContentsUrl,
  getSharePointDocumentPermissionsUrl,
  getSharePointReadScopes,
  isSharedDocumentsRoot,
  type SharePointDocumentAccess,
} from '@/lib/sharePointAccess';
import {
  internalServerErrorResponse,
  unauthorizedResponse,
} from '@/lib/apiResponses';
import { fetchWithTrace } from '@/lib/apiTracing';
import {
  MAX_DOCUMENT_UPLOAD_FILES,
  MAX_DOCUMENT_UPLOAD_SIZE,
  validateDocumentUploadContentLength,
} from '@/lib/documentUploadLimits';
import { UnauthorizedError } from '@/lib/types';
import { requireUserCaseAccess, UserAccessError } from '@/lib/userAccess';
import { validateTokenOrNull } from '@/lib/validateToken';
import * as msal from '@azure/msal-node';
import { log } from 'console';
import { decodeJwt } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

const CLIENT_ID = process.env.NEXT_PUBLIC_AAD_CLIENT_ID!;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET!;
const SHAREPOINT_HOST = process.env.SHAREPOINT_HOST!; // e.g. "contoso.sharepoint.com"
const FIELD_NAME = 'file';

async function fetchSharePointDocumentAccess({
  accessToken,
  caseId,
  path,
}: {
  accessToken: string;
  caseId: string;
  path?: string[];
}): Promise<SharePointDocumentAccess> {
  const folderPermissionsUrl = getSharePointDocumentPermissionsUrl(
    SHAREPOINT_HOST,
    caseId,
    path,
  );

  try {
    const response = await fetchWithTrace(folderPermissionsUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json;odata=verbose',
      },
    });

    if (!response.ok) {
      logger.warn(
        'Unable to fetch SharePoint folder permissions; defaulting document operations to viewer-only.',
        response.status,
      );
      return DEFAULT_SHAREPOINT_DOCUMENT_ACCESS;
    }

    const data = await response.json();
    return getDocumentAccessFromPermissions(
      extractEffectiveBasePermissions(data),
    );
  } catch (error) {
    logger.warn(
      'Unable to determine SharePoint document access role; defaulting document operations to viewer-only.',
      error,
    );
    return DEFAULT_SHAREPOINT_DOCUMENT_ACCESS;
  }
}

async function authorizeDocumentFeatureAccess(
  incoming: string,
  caseId: string,
  operation: string,
) {
  const payload = await validateTokenOrNull(incoming, operation);
  if (!payload) {
    throw new UnauthorizedError();
  }

  const oid = payload.oid as string | undefined;
  if (!oid) {
    throw new UnauthorizedError('Missing oid claim');
  }

  await requireUserCaseAccess(oid, caseId, {
    requireIsActive: true,
    allowInactiveGuestAccess: true,
    requiredFeature: 'canAccessDocuments',
  });
}

function byteArrayToBase64(bytes: Uint8Array): string {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('Input must be a Uint8Array');
  }

  // Node.js environment
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  // Browser environment
  let binary = '';
  const chunkSize = 0x8000; // Process in chunks to avoid call stack limits
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/cases/[caseId]/documents/[...path]'>,
) {
  const { caseId, path } = await ctx.params;
  const isFile = request.nextUrl.searchParams.get('isFile') === 'true';
  log(
    'GET /api/accounts/cases/[caseId]/documents/[...path] for caseId:',
    caseId,
    'and path:',
    path,
  );
  // Fetch documents for the specific case and path
  // 1) Read user's access token that your client sent to this API
  const auth = request.headers.get('authorization') || '';
  const incoming = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!incoming)
    return NextResponse.json({ error: 'Missing bearer' }, { status: 401 });

  try {
    await authorizeDocumentFeatureAccess(
      incoming,
      caseId,
      '/api/accounts/cases/[caseId]/documents/[...path]',
    );
  } catch (error) {
    if (error instanceof UserAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    logger.error(
      'Token validation infrastructure failure during document authorization:',
      error,
    );
    return internalServerErrorResponse();
  }

  // 2) Get tenant from the incoming token (or hardcode your tenant id)
  const { tid } = decodeJwt(incoming) as { tid?: string };
  const tenantId = tid || process.env.NEXT_PUBLIC_AAD_TENANT_ID!;
  const authority = `https://login.microsoftonline.com/${tenantId}`;

  // 3) Exchange with OBO for a SharePoint-scoped token
  const cca = new msal.ConfidentialClientApplication({
    auth: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, authority },
  });

  let tokenResp: Awaited<ReturnType<typeof cca.acquireTokenOnBehalfOf>>;
  try {
    tokenResp = await cca.acquireTokenOnBehalfOf({
      authority,
      scopes: getSharePointReadScopes(
        SHAREPOINT_HOST,
        process.env.AZURE_SHAREPOINT_READ_SCOPES ??
          process.env.AZURE_SHAREPOINT_READ_SCOPE,
      ), // read-only SharePoint audience
      oboAssertion: incoming, // <- the incoming user token
    });
  } catch (error) {
    logger.error('SharePoint OBO token exchange failed:', error);
    const message =
      error instanceof Error ? error.message : 'Token exchange failed';
    const details = message.includes('AADSTS7000215')
      ? 'Invalid Azure client secret. Set AZURE_CLIENT_SECRET to the client secret value, not the secret ID.'
      : 'Unable to exchange credentials for SharePoint access.';

    return NextResponse.json(
      { error: 'SharePoint token exchange failed', details },
      { status: 502 },
    );
  }

  if (!tokenResp?.accessToken) {
    return NextResponse.json({ error: 'Failed OBO exchange' }, { status: 502 });
  }

  const serverRelativeUrl = isFile
    ? encodeURI(`/sites/${caseId}/Shared Documents/${path?.join('/') || ''}`)
    : '';

  const sharePointPath = isFile
    ? `https://${SHAREPOINT_HOST}/sites/${caseId}/_api/web/GetFileByServerRelativePath(decodedurl='${serverRelativeUrl}')?$expand=ListItemAllFields`
    : getSharePointFolderContentsUrl(SHAREPOINT_HOST, caseId, path);

  // 5) Call SharePoint REST API to get the document
  const sharePointRequest = {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${tokenResp.accessToken}`,
      Accept: 'application/json;odata=verbose',
    },
  };
  let spResponse = await fetchWithTrace(sharePointPath, sharePointRequest);
  let fallbackData: Record<string, unknown> | undefined;

  if (!isFile && !path?.length && spResponse.status === 404) {
    spResponse = await fetchWithTrace(
      getSharePointDefaultLibraryContentsUrl(SHAREPOINT_HOST, caseId),
      sharePointRequest,
    );
    if (spResponse.ok) {
      fallbackData = (await spResponse.json()) as Record<string, unknown>;
      const folder = fallbackData.d as
        | { ServerRelativeUrl?: string }
        | undefined;
      if (!isSharedDocumentsRoot(caseId, folder?.ServerRelativeUrl)) {
        return NextResponse.json(
          { error: 'Shared Documents library root not found' },
          { status: 404 },
        );
      }
    }
  }

  if (!spResponse.ok) {
    const errorText = await spResponse.text();
    if (!isFile && !path?.length && spResponse.status === 404) {
      const siteResponse = await fetchWithTrace(
        `https://${SHAREPOINT_HOST}/sites/${caseId}/_api/web?$select=ServerRelativeUrl`,
        sharePointRequest,
      );
      return NextResponse.json(
        {
          error: siteResponse.ok
            ? 'Shared Documents library not found or inaccessible'
            : 'SharePoint case site not found or inaccessible',
          details: errorText,
        },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: 'SharePoint API error', details: errorText },
      { status: spResponse.status },
    );
  }

  const data = fallbackData ?? (await spResponse.json());
  data.baseUrl = process.env.SHAREPOINT_HOST;
  if (!isFile) {
    data.documentAccess = await fetchSharePointDocumentAccess({
      accessToken: tokenResp.accessToken,
      caseId,
      path,
    });
    data.documentAccessRole = data.documentAccess.role;
  }

  if (isFile) {
    const contentDownloadResponse = await fetchWithTrace(
      `https://${SHAREPOINT_HOST}/sites/${caseId}/_api/web/GetFileByServerRelativePath(decodedurl='${serverRelativeUrl}')/$value`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenResp.accessToken}`,
          Accept: 'application/json;odata=verbose',
        },
      },
    );
    if (!contentDownloadResponse.ok) {
      const errorText = await contentDownloadResponse.text();
      return NextResponse.json(
        { error: 'SharePoint API error while downloading', details: errorText },
        { status: contentDownloadResponse.status },
      );
    }
    data.content = byteArrayToBase64(await contentDownloadResponse.bytes());
  }
  return NextResponse.json(data);
}

export async function PUT(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/cases/[caseId]/documents/[...path]'>,
) {
  const { caseId, path } = await ctx.params;
  const contentLengthError = validateDocumentUploadContentLength(
    request.headers.get('content-length'),
  );
  if (contentLengthError) {
    return NextResponse.json(
      { error: contentLengthError.error },
      { status: contentLengthError.status },
    );
  }

  log(
    'POST /api/accounts/cases/[caseId]/documents/[...path] for caseId:',
    caseId,
    'and path:',
    path,
  );
  // Fetch documents for the specific case and path
  // 1) Read user's access token that your client sent to this API
  const auth = request.headers.get('authorization') || '';
  const incoming = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!incoming)
    return NextResponse.json({ error: 'Missing bearer' }, { status: 401 });

  try {
    await authorizeDocumentFeatureAccess(
      incoming,
      caseId,
      '/api/accounts/cases/[caseId]/documents/[...path]',
    );
  } catch (error) {
    if (error instanceof UserAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    logger.error(
      'Token validation infrastructure failure during document authorization:',
      error,
    );
    return internalServerErrorResponse();
  }

  // 2) Get tenant from the incoming token (or hardcode your tenant id)
  const { tid } = decodeJwt(incoming) as { tid?: string };
  const tenantId = tid || process.env.NEXT_PUBLIC_AAD_TENANT_ID!;
  const authority = `https://login.microsoftonline.com/${tenantId}`;

  // 3) Exchange with OBO for a SharePoint-scoped token
  const cca = new msal.ConfidentialClientApplication({
    auth: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, authority },
  });

  const tokenResp = await cca.acquireTokenOnBehalfOf({
    authority,
    scopes: [`https://${SHAREPOINT_HOST}/.default`], // SharePoint audience
    oboAssertion: incoming, // <- the incoming user token
  });

  if (!tokenResp?.accessToken) {
    return NextResponse.json({ error: 'Failed OBO exchange' }, { status: 502 });
  }

  const formData = await request.formData();

  // The client sends one file per request. Keep the route aligned so the
  // multipart parser cannot buffer multiple near-limit files.
  const parts = formData.getAll(FIELD_NAME) as unknown[];
  const files: File[] = parts.filter((p): p is File => p instanceof File);

  if (!files.length) {
    return NextResponse.json(
      { error: `No '${FIELD_NAME}' in form data` },
      { status: 400 },
    );
  }
  if (files.length > MAX_DOCUMENT_UPLOAD_FILES) {
    return NextResponse.json(
      { error: 'Only one file can be uploaded per request.' },
      { status: 400 },
    );
  }

  const serverRelativeUrl = encodeURI(
    `/sites/${caseId}/Shared Documents/${path?.join('/') || ''}`,
  );

  const saved = [];
  for (const file of files) {
    // Basic validation
    if (file.size > MAX_DOCUMENT_UPLOAD_SIZE) {
      return NextResponse.json(
        { error: `File too large: ${(file.size / 1_000_000).toFixed(2)} MB` },
        { status: 413 },
      );
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    const url =
      `https://${SHAREPOINT_HOST}/sites/${caseId}` +
      `/_api/web/GetFolderByServerRelativeUrl('${serverRelativeUrl}')` +
      `/Files/add(overwrite=true,url='${encodeURIComponent(safeName)}')`;

    const up = await fetchWithTrace(url, {
      method: 'POST',
      // With OAuth Bearer, you do NOT need X-RequestDigest (form digest)
      headers: {
        Authorization: `Bearer ${tokenResp.accessToken}`,
        Accept: 'application/json;odata=nometadata',
      },
      body: file, // raw file bytes
    });

    const text = await up.text();
    const payload = text
      ? (() => {
          try {
            return JSON.parse(text);
          } catch {
            return { text };
          }
        })()
      : undefined;
    if (!up.ok) {
      return NextResponse.json(
        { error: 'SharePoint upload error', details: payload },
        { status: up.status },
      );
    }

    saved.push(payload);
  }

  return NextResponse.json({ saved }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/cases/[caseId]/documents/[...path]'>,
) {
  const { caseId, path } = await ctx.params;
  const isFile = request.nextUrl.searchParams.get('isFile') === 'true';
  log(
    'DELETE /api/accounts/cases/[caseId]/documents/[...path] for caseId:',
    caseId,
    'and path:',
    path,
  );
  // Fetch documents for the specific case and path
  // 1) Read user's access token that your client sent to this API
  const auth = request.headers.get('authorization') || '';
  const incoming = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!incoming)
    return NextResponse.json({ error: 'Missing bearer' }, { status: 401 });

  try {
    await authorizeDocumentFeatureAccess(
      incoming,
      caseId,
      '/api/accounts/cases/[caseId]/documents/[...path]',
    );
  } catch (error) {
    if (error instanceof UserAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    logger.error(
      'Token validation infrastructure failure during document authorization:',
      error,
    );
    return internalServerErrorResponse();
  }

  // 2) Get tenant from the incoming token (or hardcode your tenant id)
  const { tid } = decodeJwt(incoming) as { tid?: string };
  const tenantId = tid || process.env.NEXT_PUBLIC_AAD_TENANT_ID!;
  const authority = `https://login.microsoftonline.com/${tenantId}`;

  // 3) Exchange with OBO for a SharePoint-scoped token
  const cca = new msal.ConfidentialClientApplication({
    auth: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, authority },
  });

  const tokenResp = await cca.acquireTokenOnBehalfOf({
    authority,
    scopes: [`https://${SHAREPOINT_HOST}/.default`], // SharePoint audience
    oboAssertion: incoming, // <- the incoming user token
  });

  if (!tokenResp?.accessToken) {
    return NextResponse.json({ error: 'Failed OBO exchange' }, { status: 502 });
  }

  const serverRelativeUrl = encodeURI(
    `/sites/${caseId}/Shared Documents/${path?.join('/') || ''}`,
  );

  const sharePointPath = isFile
    ? `https://${SHAREPOINT_HOST}/sites/${caseId}/_api/web/GetFileByServerRelativePath(decodedurl='${serverRelativeUrl}')`
    : `https://${SHAREPOINT_HOST}/sites/${caseId}/_api/web/GetFolderByServerRelativeUrl('Shared Documents/${path?.join('/') || ''}')`;

  const deleteResponse = await fetchWithTrace(sharePointPath, {
    method: 'DELETE',
    // With OAuth Bearer, you do NOT need X-RequestDigest (form digest)
    headers: {
      Authorization: `Bearer ${tokenResp.accessToken}`,
      Accept: 'application/json;odata=nometadata',
    },
  });

  if (!deleteResponse.ok) {
    const errorText = await deleteResponse.text();
    return NextResponse.json(
      { error: 'SharePoint API error while deleting', details: errorText },
      { status: deleteResponse.status },
    );
  }

  logger.info(
    `Deleted ${isFile ? 'file' : 'folder'} successfully from SharePoint`,
  );

  return NextResponse.json({
    message: isFile ? 'File deleted' : 'Folder deleted',
  });
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/cases/[caseId]/documents/[...path]'>,
) {
  const { caseId, path } = await ctx.params;
  log(
    'POST /api/accounts/cases/[caseId]/documents/[...path] for caseId:',
    caseId,
    'and path:',
    path,
  );
  // Fetch documents for the specific case and path
  // 1) Read user's access token that your client sent to this API
  const auth = request.headers.get('authorization') || '';
  const incoming = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!incoming)
    return NextResponse.json({ error: 'Missing bearer' }, { status: 401 });

  try {
    await authorizeDocumentFeatureAccess(
      incoming,
      caseId,
      '/api/accounts/cases/[caseId]/documents/[...path]',
    );
  } catch (error) {
    if (error instanceof UserAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    logger.error(
      'Token validation infrastructure failure during document authorization:',
      error,
    );
    return internalServerErrorResponse();
  }

  // 2) Get tenant from the incoming token (or hardcode your tenant id)
  const { tid } = decodeJwt(incoming) as { tid?: string };
  const tenantId = tid || process.env.NEXT_PUBLIC_AAD_TENANT_ID!;
  const authority = `https://login.microsoftonline.com/${tenantId}`;

  // 3) Exchange with OBO for a SharePoint-scoped token
  const cca = new msal.ConfidentialClientApplication({
    auth: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, authority },
  });

  const tokenResp = await cca.acquireTokenOnBehalfOf({
    authority,
    scopes: [`https://${SHAREPOINT_HOST}/.default`], // SharePoint audience
    oboAssertion: incoming, // <- the incoming user token
  });

  if (!tokenResp?.accessToken) {
    return NextResponse.json({ error: 'Failed OBO exchange' }, { status: 502 });
  }

  const serverRelativeUrl = encodeURI(
    `/sites/${caseId}/Shared Documents/${path?.join('/') || ''}`,
  );

  const folderName = (await request.json()).folderName || 'New Folder';

  const url =
    `https://${SHAREPOINT_HOST}/sites/${caseId}` +
    `/_api/web/GetFolderByServerRelativeUrl('${serverRelativeUrl}')` +
    `/Folders/add('${encodeURIComponent(folderName)}')`;

  const up = await fetchWithTrace(url, {
    method: 'POST',
    // With OAuth Bearer, you do NOT need X-RequestDigest (form digest)
    headers: {
      Authorization: `Bearer ${tokenResp.accessToken}`,
      Accept: 'application/json;odata=nometadata',
    },
  });

  const text = await up.text();
  const payload = text
    ? (() => {
        try {
          return JSON.parse(text);
        } catch {
          return { text };
        }
      })()
    : undefined;
  if (!up.ok) {
    return NextResponse.json(
      { error: 'SharePoint upload error', details: payload },
      { status: up.status },
    );
  }

  return NextResponse.json({}, { status: 200 });
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/cases/[caseId]/documents/[...path]'>,
) {
  const { caseId, path } = await ctx.params;
  log(
    'PATCH /api/accounts/cases/[caseId]/documents/[...path] for caseId:',
    caseId,
    'and path:',
    path,
  );
  // Fetch documents for the specific case and path
  const auth = request.headers.get('authorization') || '';
  const incoming = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!incoming)
    return NextResponse.json({ error: 'Missing bearer' }, { status: 401 });

  try {
    await authorizeDocumentFeatureAccess(
      incoming,
      caseId,
      '/api/accounts/cases/[caseId]/documents/[...path]',
    );
  } catch (error) {
    if (error instanceof UserAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    logger.error(
      'Token validation infrastructure failure during document authorization:',
      error,
    );
    return internalServerErrorResponse();
  }

  // 2) Get tenant from the incoming token (or hardcode your tenant id)
  const { tid } = decodeJwt(incoming) as { tid?: string };
  const tenantId = tid || process.env.NEXT_PUBLIC_AAD_TENANT_ID!;
  const authority = `https://login.microsoftonline.com/${tenantId}`;

  // 3) Exchange with OBO for a SharePoint-scoped token
  const cca = new msal.ConfidentialClientApplication({
    auth: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, authority },
  });

  const tokenResp = await cca.acquireTokenOnBehalfOf({
    authority,
    scopes: [`https://${SHAREPOINT_HOST}/.default`], // SharePoint audience
    oboAssertion: incoming, // <- the incoming user token
  });

  if (!tokenResp?.accessToken) {
    return NextResponse.json({ error: 'Failed OBO exchange' }, { status: 502 });
  }

  const serverRelativeUrl = encodeURI(
    `/sites/${caseId}/Shared Documents/${path?.join('/') || ''}`,
  );

  const folderName = (await request.json()).folderName || 'New Folder';

  const newServerRelativeUrl = encodeURI(
    `/sites/${caseId}/Shared Documents/${path?.slice(0, -1)?.join('/') || ''}/${folderName}`,
  );

  const url =
    `https://${SHAREPOINT_HOST}/sites/${caseId}` +
    `/_api/web/GetFolderByServerRelativeUrl('${serverRelativeUrl}')` +
    `/MoveTo(newurl='${newServerRelativeUrl}')`;

  const up = await fetchWithTrace(url, {
    method: 'POST',
    // With OAuth Bearer, you do NOT need X-RequestDigest (form digest)
    headers: {
      Authorization: `Bearer ${tokenResp.accessToken}`,
      Accept: 'application/json;odata=nometadata',
    },
  });

  const text = await up.text();
  const payload = text
    ? (() => {
        try {
          return JSON.parse(text);
        } catch {
          return { text };
        }
      })()
    : undefined;
  if (!up.ok) {
    return NextResponse.json(
      { error: 'SharePoint upload error', details: payload },
      { status: up.status },
    );
  }

  return NextResponse.json({}, { status: 200 });
}
