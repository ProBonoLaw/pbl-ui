import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGraphAttorneyField, normalizeGraphAttorneyPatch } from '../lib/graphExtension';
import { updateGraphUserByOid } from '../lib/graph';

test('configured Graph extensions round-trip through the stable profile field', async () => {
  const previous = process.env.NEXT_PUBLIC_AAD_ATTORNEY_EXTENSION;
  process.env.NEXT_PUBLIC_AAD_ATTORNEY_EXTENSION = 'extension_otherexample_IsAttorney';
  try {
    assert.deepEqual(normalizeGraphAttorneyField({ id: 'example', extension_otherexample_IsAttorney: false }),
      { id: 'example', isAttorney: false });
    assert.deepEqual(normalizeGraphAttorneyPatch({ extension_otherexample_IsAttorney: true }), { isAttorney: true });
    assert.deepEqual(normalizeGraphAttorneyPatch({ givenName: 'Example' }), { givenName: 'Example' });
    let sent: unknown;
    await updateGraphUserByOid('example-user', { isAttorney: true, givenName: 'Example' }, {
      getAccessToken: async () => 'mock-token',
      fetcher: async (_url, options) => {
        sent = JSON.parse(String(options?.body));
        return new Response(null, { status: 204 });
      },
    });
    assert.deepEqual(sent, { givenName: 'Example', extension_otherexample_IsAttorney: true });
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_AAD_ATTORNEY_EXTENSION;
    else process.env.NEXT_PUBLIC_AAD_ATTORNEY_EXTENSION = previous;
  }
});
