import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { getPrivacyPolicyDocument } from '../lib/privacyPolicyDocuments.ts';

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

test('SOC 2 report route serves the PDF inline', () => {
  const source = read('app/api/privacy/soc-2-type-2-report/route.ts');

  assert.match(
    source,
    /'deploy',[\s\S]*'private',[\s\S]*'soc2-report\.pdf'/,
  );
  assert.match(source, /readFile\(SOC2_REPORT_PATH\)/);
  assert.match(source, /const reportBody = new Uint8Array\(report\)/);
  assert.match(source, /new NextResponse\(reportBody/);
  assert.doesNotMatch(source, /new Uint8Array\(report\)\.buffer/);
  assert.doesNotMatch(source, /report\.buffer/);
  assert.match(source, /Content-Type': 'application\/pdf'/);
  assert.match(
    source,
    /inline; filename="probono-law-soc-2-type-2-report\.pdf"/,
  );
  assert.match(source, /SOC 2 Type 2 report not found[\s\S]*status:\s*404/);
});
