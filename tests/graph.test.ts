import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getEmailFromGraphByOid,
  getIsAttorneyFromGraphByOid,
  updateGraphMobilePhoneForUser,
  updateGraphUserByOid,
  updateOwnGraphMobilePhoneOnBehalfOf,
  uploadGraphUserPhotoByOid,
} from '../lib/graph.ts';

test('getEmailFromGraphByOid returns null when no app token is available', async () => {
  const result = await getEmailFromGraphByOid('oid-1', {
    getAccessToken: async () => null,
    fetcher: async () => {
      throw new Error('fetch should not be called when token is missing');
    },
  });

  assert.equal(result, null);
});

test('getEmailFromGraphByOid returns mail first and calls graph with bearer auth', async () => {
  let calledUrl: string | undefined;
  let calledAuth: string | null | undefined;

  const result = await getEmailFromGraphByOid('oid-2', {
    getAccessToken: async () => 'token-abc',
    fetcher: async (input, init) => {
      calledUrl = String(input);
      calledAuth = new Headers(init?.headers).get('Authorization');
      return new Response(
        JSON.stringify({ mail: 'person@example.com', userPrincipalName: 'upn@example.com' }),
        { status: 200 },
      );
    },
  });

  assert.equal(result, 'person@example.com');
  assert.equal(
    calledUrl,
    'https://graph.microsoft.com/v1.0/users/oid-2?$select=mail,userPrincipalName',
  );
  assert.equal(calledAuth, 'Bearer token-abc');
});

test('updateGraphUserByOid sends PATCH to the expected endpoint', async () => {
  let method: string | undefined;
  let body: string | undefined;

  const response = await updateGraphUserByOid(
    'oid-3',
    { displayName: 'Updated Name' },
    {
      getAccessToken: async () => 'token-xyz',
      fetcher: async (_input, init) => {
        method = init?.method;
        body = String(init?.body ?? '');
        return new Response(null, { status: 204 });
      },
    },
  );

  assert.ok(response);
  assert.equal(method, 'PATCH');
  assert.equal(body, JSON.stringify({ displayName: 'Updated Name' }));
});

test('updateOwnGraphMobilePhoneOnBehalfOf PATCHes the signed-in Graph user', async () => {
  let receivedAssertion: string | undefined;
  let calledUrl: string | undefined;
  let calledAuth: string | null | undefined;
  let body: string | undefined;

  const response = await updateOwnGraphMobilePhoneOnBehalfOf(
    'api-token',
    '+1-555-0100',
    {
      getAccessToken: async (assertion) => {
        receivedAssertion = assertion;
        return 'delegated-graph-token';
      },
      fetcher: async (input, init) => {
        calledUrl = String(input);
        calledAuth = new Headers(init?.headers).get('Authorization');
        body = String(init?.body ?? '');
        return new Response(null, { status: 204 });
      },
    },
  );

  assert.equal(response?.status, 204);
  assert.equal(receivedAssertion, 'api-token');
  assert.equal(calledUrl, 'https://graph.microsoft.com/v1.0/me');
  assert.equal(calledAuth, 'Bearer delegated-graph-token');
  assert.equal(body, JSON.stringify({ mobilePhone: '+1-555-0100' }));
});

test('updateGraphMobilePhoneForUser falls back to app access when self-update is denied', async () => {
  let appOid: string | undefined;
  let appBody: { mobilePhone: string | null } | undefined;

  const response = await updateGraphMobilePhoneForUser(
    'user-oid',
    'api-token',
    '+1-555-0101',
    {
      updateOnBehalfOf: async () => new Response('Forbidden', { status: 403 }),
      updateByOid: async (oid, body) => {
        appOid = oid;
        appBody = body;
        return new Response(null, { status: 204 });
      },
    },
  );

  assert.equal(response?.status, 204);
  assert.equal(appOid, 'user-oid');
  assert.deepEqual(appBody, { mobilePhone: '+1-555-0101' });
});

test('updateGraphMobilePhoneForUser does not retry a rejected phone value', async () => {
  let appCalls = 0;

  const response = await updateGraphMobilePhoneForUser(
    'user-oid',
    'api-token',
    'invalid',
    {
      updateOnBehalfOf: async () => new Response('Invalid', { status: 400 }),
      updateByOid: async () => {
        appCalls += 1;
        return new Response(null, { status: 204 });
      },
    },
  );

  assert.equal(response?.status, 400);
  assert.equal(appCalls, 0);
});

test('getIsAttorneyFromGraphByOid throws when no app token is available', async () => {
  await assert.rejects(
    getIsAttorneyFromGraphByOid('oid-3', {
      getAccessToken: async () => null,
      fetcher: async () => {
        throw new Error('fetch should not be called when token is missing');
      },
    }),
    /Failed to acquire Graph app access token/,
  );
});

test('getIsAttorneyFromGraphByOid returns boolean and calls expected endpoint', async () => {
  let calledUrl: string | undefined;
  let calledAuth: string | null | undefined;

  const result = await getIsAttorneyFromGraphByOid('oid-4', {
    getAccessToken: async () => 'token-123',
    fetcher: async (input, init) => {
      calledUrl = String(input);
      calledAuth = new Headers(init?.headers).get('Authorization');
      return new Response(
        JSON.stringify({
          extension_example_IsAttorney: false,
        }),
        { status: 200 },
      );
    },
  });

  assert.equal(result, false);
  assert.equal(
    calledUrl,
    'https://graph.microsoft.com/v1.0/users/oid-4?$select=extension_example_IsAttorney',
  );
  assert.equal(calledAuth, 'Bearer token-123');
});

test('getIsAttorneyFromGraphByOid defaults null or missing extension value to false', async () => {
  const nullValue = await getIsAttorneyFromGraphByOid('oid-6', {
    getAccessToken: async () => 'token-123',
    fetcher: async () =>
      new Response(
        JSON.stringify({
          extension_example_IsAttorney: null,
        }),
        { status: 200 },
      ),
  });

  const missingValue = await getIsAttorneyFromGraphByOid('oid-7', {
    getAccessToken: async () => 'token-123',
    fetcher: async () => new Response(JSON.stringify({}), { status: 200 }),
  });

  assert.equal(nullValue, false);
  assert.equal(missingValue, false);
});

test('getIsAttorneyFromGraphByOid throws when Graph request fails', async () => {
  await assert.rejects(
    getIsAttorneyFromGraphByOid('oid-5', {
      getAccessToken: async () => 'token-123',
      fetcher: async () => new Response('forbidden', { status: 403 }),
    }),
    /Failed to load attorney status from Graph: 403/,
  );
});

test('getIsAttorneyFromGraphByOid throws when extension value has unexpected type', async () => {
  await assert.rejects(
    getIsAttorneyFromGraphByOid('oid-8', {
      getAccessToken: async () => 'token-123',
      fetcher: async () =>
        new Response(
          JSON.stringify({
            extension_example_IsAttorney: 'yes',
          }),
          { status: 200 },
        ),
    }),
    /Graph attorney status is invalid/,
  );
});

test('uploadGraphUserPhotoByOid sends PUT and returns response', async () => {
  let method: string | undefined;

  const response = await uploadGraphUserPhotoByOid(
    'oid-4',
    new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }),
    {
      getAccessToken: async () => 'token-photo',
      fetcher: async (_input, init) => {
        method = init?.method;
        return new Response(null, { status: 204 });
      },
    },
  );

  assert.ok(response);
  assert.equal(method, 'PUT');
});
