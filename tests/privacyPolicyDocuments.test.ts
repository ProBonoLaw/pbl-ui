import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { getPrivacyPolicyDocument } from '../lib/privacyPolicyDocuments.ts';
import { GET as getSoc2Report } from '../app/api/privacy/soc-2-type-2-report/route.ts';

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf-8');
}

test('loads the markdown-backed privacy policy document', async () => {
  const document = await getPrivacyPolicyDocument();

  assert.equal(document.title, 'PRIVACY POLICY');
  assert.equal(typeof document.markdown, 'string');
});

test('privacy policy markdown route serves public markdown', () => {
  const source = read('app/api/privacy/policy/route.ts');

  assert.match(source, /export async function GET\(\)/);
  assert.match(source, /getPrivacyPolicyDocument\(\)/);
  assert.match(source, /Content-Type': 'text\/markdown; charset=utf-8'/);
  assert.match(source, /Privacy policy not found[\s\S]*status:\s*404/);
});

test('SOC 2 download is closed and cannot be cached even in the private repository', async () => {
  const response = await getSoc2Report();

  assert.equal(response.status, 410);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.match(response.headers.get('content-type') ?? '', /^application\/json(?:;|$)/);
  assert.equal(response.headers.get('content-disposition'), null);
  assert.deepEqual(await response.json(), {
    error: 'SOC 2 Type 2 reports are available by email request only.',
  });
});
