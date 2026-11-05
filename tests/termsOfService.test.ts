import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { getTermsTypeForBillingCode } from '../lib/termsOfService.ts';
import { getTermsOfServiceDocument } from '../lib/termsOfServiceDocuments.ts';

test('maps billing codes to terms of service types', () => {
  assert.equal(getTermsTypeForBillingCode('D'), 'demo');
  assert.equal(getTermsTypeForBillingCode('S1'), 'silver');
  assert.equal(getTermsTypeForBillingCode('G1'), 'gold');
  assert.equal(getTermsTypeForBillingCode('F'), 'pro-bono');
  assert.equal(getTermsTypeForBillingCode(undefined), 'general');
});

test('loads user account terms from user/default.md', async () => {
  const document = await getTermsOfServiceDocument({
    scope: 'user-account',
    termsType: 'demo',
  });

  assert.equal(document.title, 'MASTER TERMS OF SERVICE');
  assert.match(document.markdown, /Master Terms of Service/);
  assert.match(document.acknowledgement, /Pro Bono Law Terms of Service/);
});

test('loads case terms from the billing-code agreement file', async () => {
  const document = await getTermsOfServiceDocument({
    scope: 'case',
    termsType: 'demo',
  });

  assert.equal(document.title, 'Cloud Services Evaluation Agreement');
  assert.match(document.effectiveDate ?? '', /May 22, 2026/);
  assert.match(document.markdown, /Cloud Services/);
  assert.match(document.acknowledgement, /demo case terms/i);
});

test('strips underscore italic last modified metadata from terms markdown', async () => {
  const document = await getTermsOfServiceDocument({
    scope: 'user-account',
    termsType: 'general',
  });

  assert.equal(document.effectiveDate, 'October 31, 2026');
  assert.doesNotMatch(document.markdown, /Last Modified:/);
  assert.doesNotMatch(document.markdown, /_Last Modified:/);
});

test('reuses one loaded archive for clickwrap documents', async () => {
  const source = readFileSync(resolve(process.cwd(), 'lib/legalDocuments.ts'), 'utf8');

  assert.match(source, /const archive = await loadLegalArchive\(\)/);
  assert.match(
    source,
    /getClickwrapDocuments[\s\S]*readLegalDocument\(id, archive\)/,
  );
  assert.doesNotMatch(
    source,
    /getClickwrapDocuments[\s\S]*map\(getLegalDocument\)/,
  );
});
