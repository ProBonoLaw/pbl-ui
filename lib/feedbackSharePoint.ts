import 'server-only';

import { fetchWithTrace } from '@/lib/apiTracing';
import { getSharePointReadScopes } from '@/lib/sharePointAccess';
import * as msal from '@azure/msal-node';
import { decodeJwt } from 'jose';

type FeedbackFileReference = {
  itemId?: string;
  uniqueId?: string;
};

function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

async function getSharePointAccessToken(incoming: string): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_AAD_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const sharePointHost = process.env.SHAREPOINT_HOST;
  const { tid } = decodeJwt(incoming) as { tid?: string };
  const tenantId = tid || process.env.NEXT_PUBLIC_AAD_TENANT_ID;

  if (!clientId || !clientSecret || !sharePointHost || !tenantId) {
    throw new Error('SharePoint configuration is missing');
  }

  const authority = `https://login.microsoftonline.com/${tenantId}`;
  const client = new msal.ConfidentialClientApplication({
    auth: { clientId, clientSecret, authority },
  });
  const tokenResponse = await client.acquireTokenOnBehalfOf({
    authority,
    scopes: getSharePointReadScopes(
      sharePointHost,
      process.env.AZURE_SHAREPOINT_READ_SCOPES ??
        process.env.AZURE_SHAREPOINT_READ_SCOPE,
    ),
    oboAssertion: incoming,
  });

  if (!tokenResponse?.accessToken) {
    throw new Error('SharePoint token exchange returned no access token');
  }

  return tokenResponse.accessToken;
}

function getSharePointValueUrl(
  sharePointHost: string,
  accountId: string,
  reference: FeedbackFileReference,
): string | null {
  const siteUrl = `https://${sharePointHost}/sites/${encodeURIComponent(accountId)}`;

  if (reference.itemId && /^\d+$/.test(reference.itemId)) {
    return (
      `${siteUrl}/_api/web/GetList('/sites/${escapeODataString(accountId)}/Shared Documents')` +
      `/items(${reference.itemId})/File/$value`
    );
  }

  if (reference.uniqueId) {
    return `${siteUrl}/_api/web/GetFileById('${escapeODataString(reference.uniqueId)}')/$value`;
  }

  return null;
}

export async function fetchFeedbackSharePointFile({
  incoming,
  accountId,
  reference,
}: {
  incoming: string;
  accountId: string;
  reference: FeedbackFileReference;
}) {
  const sharePointHost = process.env.SHAREPOINT_HOST;
  if (!sharePointHost) {
    throw new Error('SHAREPOINT_HOST is missing');
  }

  const url = getSharePointValueUrl(sharePointHost, accountId, reference);
  if (!url) {
    throw new Error('Feedback file has no usable SharePoint identifier');
  }

  const accessToken = await getSharePointAccessToken(incoming);
  return fetchWithTrace(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/octet-stream',
    },
  });
}
