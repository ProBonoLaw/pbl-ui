import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getCaseCreationFeatures } from '../lib/caseCreationFeatures.ts';

test('enables Gold feature flags for G1 billing code', () => {
  assert.deepEqual(getCaseCreationFeatures('G1', false), {
    addGoldFeatures: true,
    useDedicatedEmailAddress: true,
  });
});

test('enables Gold feature flags for F billing code when caller is attorney', () => {
  assert.deepEqual(getCaseCreationFeatures('F', true), {
    addGoldFeatures: true,
    useDedicatedEmailAddress: true,
  });
});

test('disables Gold feature flags for F billing code when caller is non-attorney', () => {
  assert.deepEqual(getCaseCreationFeatures('F', false), {
    addGoldFeatures: false,
    useDedicatedEmailAddress: false,
  });
});

test('disables Gold feature flags for non-Gold billing code', () => {
  assert.deepEqual(getCaseCreationFeatures('S1', true), {
    addGoldFeatures: false,
    useDedicatedEmailAddress: false,
  });
});

test('disables Gold feature flags for Demo billing code', () => {
  assert.deepEqual(getCaseCreationFeatures('D', true), {
    addGoldFeatures: false,
    useDedicatedEmailAddress: false,
  });
});

test('create-case route uses computed feature flags in event payload', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'app/api/accounts/cases/route.ts'),
    'utf-8',
  );
  assert.match(source, /getIsAttorneyFromGraphByOid\(oid\)/);
  assert.match(source, /caseInfo\.billingCode === 'F' && !callerIsAttorney/);
  assert.match(
    source,
    /getCaseCreationFeatures\(\s*caseInfo\.billingCode,\s*callerIsAttorney,\s*\)/,
  );
  assert.match(source, /\.\.\.caseCreationFeatures/);
});
