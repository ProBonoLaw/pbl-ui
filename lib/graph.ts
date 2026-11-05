import { getAttorneyExtensionName } from './graphExtension';
import { fetchWithTrace } from './apiTracing.ts';
import * as msal from '@azure/msal-node';

type GraphDependencies = {
  fetcher?: typeof fetch;
  getAccessToken?: () => Promise<string | null>;
};

type GraphOnBehalfOfDependencies = {
  fetcher?: typeof fetch;
  getAccessToken?: (userApiToken: string) => Promise<string | null>;
};

type GraphPhoneUpdateDependencies = {
  updateOnBehalfOf?: (
    userApiToken: string,
    mobilePhone: string | null,
  ) => Promise<Response | null>;
  updateByOid?: (
    oid: string,
    body: { mobilePhone: string | null },
  ) => Promise<Response | null>;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function createGraphClientConfig() {
  const clientId = getRequiredEnv('NEXT_PUBLIC_AAD_CLIENT_ID');
  const clientSecret = getRequiredEnv('AZURE_CLIENT_SECRET');
  const tenantId = getRequiredEnv('NEXT_PUBLIC_AAD_TENANT_ID');

  return {
    auth: {
      clientId,
      clientSecret,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
  };
}

export async function getGraphAppAccessToken(): Promise<string | null> {
  const client = new msal.ConfidentialClientApplication(createGraphClientConfig());
  const tokenResponse = await client.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default'],
    skipCache: true,
  });

  return tokenResponse?.accessToken ?? null;
}

export async function getGraphOnBehalfOfAccessToken(
  userApiToken: string,
): Promise<string | null> {
  const client = new msal.ConfidentialClientApplication(createGraphClientConfig());
  const tokenResponse = await client.acquireTokenOnBehalfOf({
    oboAssertion: userApiToken,
    scopes: ['https://graph.microsoft.com/.default'],
  });

  return tokenResponse?.accessToken ?? null;
}

function getGraphDeps(deps?: GraphDependencies) {
  return {
    fetcher: deps?.fetcher ?? fetchWithTrace,
    getAccessToken: deps?.getAccessToken ?? getGraphAppAccessToken,
  };
}

export async function getEmailFromGraphByOid(
  oid: string,
  deps?: GraphDependencies,
): Promise<string | null> {
  const { fetcher, getAccessToken } = getGraphDeps(deps);
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return null;
  }

  const response = await fetcher(
    `https://graph.microsoft.com/v1.0/users/${oid}?$select=mail,userPrincipalName`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    return null;
  }

  const user = (await response.json()) as {
    mail?: string | null;
    userPrincipalName?: string | null;
  };

  return user.mail ?? user.userPrincipalName ?? null;
}

export async function getIsAttorneyFromGraphByOid(
  oid: string,
  deps?: GraphDependencies,
): Promise<boolean> {
  const { fetcher, getAccessToken } = getGraphDeps(deps);
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('Failed to acquire Graph app access token');
  }

  const response = await fetcher(
    `https://graph.microsoft.com/v1.0/users/${oid}?$select=${getAttorneyExtensionName()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    },
  );
  if (!response.ok) {
    throw new Error(
      `Failed to load attorney status from Graph: ${response.status} ${response.statusText}`,
    );
  }

  const user = (await response.json()) as Record<string, unknown>;
  const attorneyValue = user[getAttorneyExtensionName()];
  if (attorneyValue === null || attorneyValue === undefined) {
    return false;
  }
  if (typeof attorneyValue !== 'boolean') {
    throw new Error('Graph attorney status is invalid');
  }

  return attorneyValue;
}

export async function updateGraphUserByOid(
  oid: string,
  requestBody: unknown,
  deps?: GraphDependencies,
): Promise<Response | null> {
  const { fetcher, getAccessToken } = getGraphDeps(deps);
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return null;
  }

  if (requestBody && typeof requestBody === 'object' && Object.hasOwn(requestBody, 'isAttorney')) {
    const { isAttorney, ...profile } = requestBody as Record<string, unknown>;
    requestBody = { ...profile, [getAttorneyExtensionName()]: isAttorney };
  }

  return fetcher(`https://graph.microsoft.com/v1.0/users/${oid}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
}

export async function updateOwnGraphMobilePhoneOnBehalfOf(
  userApiToken: string,
  mobilePhone: string | null,
  deps?: GraphOnBehalfOfDependencies,
): Promise<Response | null> {
  const getAccessToken =
    deps?.getAccessToken ?? getGraphOnBehalfOfAccessToken;
  const accessToken = await getAccessToken(userApiToken);
  if (!accessToken) {
    return null;
  }

  const fetcher = deps?.fetcher ?? fetchWithTrace;
  return fetcher('https://graph.microsoft.com/v1.0/me', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mobilePhone }),
  });
}

export async function updateGraphMobilePhoneForUser(
  oid: string,
  userApiToken: string,
  mobilePhone: string | null,
  deps?: GraphPhoneUpdateDependencies,
): Promise<Response | null> {
  const updateOnBehalfOf =
    deps?.updateOnBehalfOf ?? updateOwnGraphMobilePhoneOnBehalfOf;
  let delegatedResponse: Response | null = null;
  try {
    delegatedResponse = await updateOnBehalfOf(userApiToken, mobilePhone);
  } catch {
    // App-only access can still update a guest when delegated self-edit cannot.
  }

  if (delegatedResponse?.ok) {
    return delegatedResponse;
  }
  if (
    delegatedResponse &&
    delegatedResponse.status !== 403 &&
    delegatedResponse.status !== 404
  ) {
    return delegatedResponse;
  }

  const updateByOid = deps?.updateByOid ?? updateGraphUserByOid;
  return updateByOid(oid, { mobilePhone });
}

export async function uploadGraphUserPhotoByOid(
  oid: string,
  photo: FormDataEntryValue,
  deps?: GraphDependencies,
): Promise<Response | null> {
  const { fetcher, getAccessToken } = getGraphDeps(deps);
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return null;
  }

  return fetcher(`https://graph.microsoft.com/v1.0/users/${oid}/photo/$value`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'image/jpeg',
    },
    body: photo,
  });
}
