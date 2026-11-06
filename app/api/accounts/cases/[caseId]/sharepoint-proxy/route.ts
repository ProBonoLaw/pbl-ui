'use server';
import { logger } from '@/lib/logger';
import {
  internalServerErrorResponse,
  unauthorizedResponse,
} from '@/lib/apiResponses';
import { fetchWithTrace } from '@/lib/apiTracing';
import { getSharePointPreviewItemUrl } from '@/lib/sharePointPreview';
import { UnauthorizedError } from '@/lib/types';
import { requireUserCaseAccess, UserAccessError } from '@/lib/userAccess';
import { validateTokenOrNull } from '@/lib/validateToken';
import * as msal from '@azure/msal-node';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  ctx: RouteContext<'/api/accounts/cases/[caseId]/sharepoint-proxy'>,
) {
  const CLIENT_ID = process.env.NEXT_PUBLIC_AAD_CLIENT_ID;
  const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
  const SHAREPOINT_HOST = process.env.SHAREPOINT_HOST;
  const { caseId } = await ctx.params;
  const externalUrl = new URL(request.url).searchParams.get('url');

  if (!externalUrl) {
    return new NextResponse('Missing URL parameter', { status: 400 });
  }

  const tenantId = process.env.NEXT_PUBLIC_AAD_TENANT_ID;
  if (!CLIENT_ID || !CLIENT_SECRET || !SHAREPOINT_HOST || !tenantId) {
    logger.error(
      'Missing required environment variables for SharePoint proxy authentication.',
    );
    return internalServerErrorResponse();
  }
  const authority = `https://login.microsoftonline.com/${tenantId}`;

  const auth = request.headers.get('authorization') || '';
  const incoming = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!incoming) {
    return NextResponse.json({ error: 'Missing bearer' }, { status: 401 });
  }

  try {
    const payload = await validateTokenOrNull(
      incoming,
      'GET /api/accounts/cases/[caseId]/sharepoint-proxy',
    );
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
      'Token validation infrastructure failure during GET /api/accounts/cases/[caseId]/sharepoint-proxy:',
      error,
    );
    return internalServerErrorResponse();
  }

  const cca = new msal.ConfidentialClientApplication({
    auth: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, authority },
  });

  const tokenResp = await cca.acquireTokenOnBehalfOf({
    authority,
    scopes: ['https://graph.microsoft.com/.default'],
    oboAssertion: incoming,
  });

  if (!tokenResp?.accessToken) {
    return NextResponse.json({ error: 'Failed OBO exchange' }, { status: 502 });
  }

  const spResponse = await fetchWithTrace(
    `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_HOST}:/sites/${caseId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenResp.accessToken}`,
        Accept: 'application/json',
      },
    },
  );

  if (!spResponse.ok) {
    logger.error(
      'Failed to fetch SharePoint site info:',
      await spResponse.text(),
    );
    return NextResponse.json(
      { error: 'Failed to fetch SharePoint site info' },
      { status: 502 },
    );
  }

  const spData = await spResponse.json();
  const siteId = spData.id;

  const driveResponse = await fetchWithTrace(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenResp.accessToken}`,
        Accept: 'application/json',
      },
    },
  );

  if (!driveResponse.ok) {
    logger.error(
      'Failed to fetch SharePoint drives:',
      await driveResponse.text(),
    );
    return NextResponse.json(
      { error: 'Failed to fetch SharePoint drives' },
      { status: 502 },
    );
  }

  const driveData = await driveResponse.json();
  const driveEntries = Array.isArray(driveData?.value)
    ? (driveData.value as Array<{ id?: string; name?: string }>)
    : [];
  const documentsDrive = driveEntries.find(
    (drive) => drive.name === 'Documents',
  );
  if (!documentsDrive?.id) {
    logger.error('Documents drive not found in SharePoint site:', siteId);
    return NextResponse.json(
      { error: 'Documents drive not found' },
      { status: 404 },
    );
  }

  const driveId = documentsDrive.id;

  const itemUrl = getSharePointPreviewItemUrl(
    externalUrl,
    caseId,
    SHAREPOINT_HOST,
    driveId,
  );
  if (!itemUrl) {
    return NextResponse.json(
      { error: 'Source URL must belong to this case in SharePoint' },
      { status: 400 },
    );
  }
  const itemResponse = await fetchWithTrace(
    itemUrl,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenResp.accessToken}`,
        Accept: 'application/json',
      },
    },
  );

  if (!itemResponse.ok) {
    logger.error(
      'Failed to fetch SharePoint item info:',
      await itemResponse.text(),
    );
    return NextResponse.json(
      { error: 'Failed to fetch SharePoint item info' },
      { status: 502 },
    );
  }

  const itemData = await itemResponse.json();
  if (
    itemData.parentReference?.driveId &&
    itemData.parentReference.driveId !== driveId
  ) {
    return NextResponse.json(
      { error: 'Source document does not belong to this case' },
      { status: 403 },
    );
  }
  const fileId = itemData.id;

  const graphRes = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(fileId)}/preview`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenResp.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    },
  );

  if (!graphRes.ok) {
    const text = await graphRes.text();
    return NextResponse.json(
      { error: 'Graph preview failed', details: text },
      { status: graphRes.status },
    );
  }

  const data = await graphRes.json();

  const previewUrl = data?.getUrl;
  if (!previewUrl) {
    return NextResponse.json(
      { error: 'No preview URL returned' },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { previewUrl: `${previewUrl}&nb=true` },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
