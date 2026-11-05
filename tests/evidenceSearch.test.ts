import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAIMIEEvidenceSearchRequest,
  EvidenceExplorerSearchInputSchema,
  EvidenceRecordSchema,
  EvidenceSearchResponseSchema,
} from '../lib/evidenceSearch.ts';

test('builds a browse request with the selected family as a mandatory tag', () => {
  const input = EvidenceExplorerSearchInputSchema.parse({
    families: ['claim'],
    query: '  ',
  });

  assert.deepEqual(buildAIMIEEvidenceSearchRequest('case-123', input), {
    accountId: 'case-123',
    query: '*',
    tags: ['claim'],
    top: 20,
    skip: 0,
  });
});

const evidenceRecord = {
  tags: ['fact'],
  who: null,
  whenStarted: null,
  whenEnded: null,
  what: 'A fact in the case',
  where: null,
  why: null,
  sourceId: null,
  source: null,
  pages: null,
};

test('accepts and preserves structured asOf dates in search results', () => {
  const dates = [
    { year: '2024', month: '10', day: '15', season: null, quarter: null },
    { year: '2024' },
    { year: '2024', month: '10' },
    { year: '2024', season: 'Spring' },
    { year: '2024', quarter: 'Q2' },
    { year: null, month: null, day: null, season: null, quarter: null },
    null,
  ];
  const response = EvidenceSearchResponseSchema.parse({
    accountId: 'case-123',
    query: '*',
    tags: ['fact'],
    top: 20,
    skip: 0,
    totalCount: dates.length,
    results: dates.map((asOf) => ({ ...evidenceRecord, asOf })),
  });

  assert.deepEqual(response.results.map((record) => record.asOf), dates);
});

test('requires asOf to be a structured date or null', () => {
  assert.equal(EvidenceRecordSchema.safeParse(evidenceRecord).success, false);
  for (const asOf of [undefined, '2024-10-15', [], 2024, { year: 2024 }]) {
    assert.equal(
      EvidenceRecordSchema.safeParse({ ...evidenceRecord, asOf }).success,
      false,
    );
  }
});

test('combines the mandatory family tag with selected exact-match filters', () => {
  const input = EvidenceExplorerSearchInputSchema.parse({
    families: ['event'],
    query: 'hearing',
    tags: ['court', 'hearing', 'court'],
    who: ['Jordan Lee', 'Avery Quinn'],
    where: 'King County',
    whenStarted: { from: '2024-01', to: '2024-12-31' },
    whenEnded: { to: '2025' },
    top: 50,
    skip: 20,
  });

  assert.deepEqual(buildAIMIEEvidenceSearchRequest('case-123', input), {
    accountId: 'case-123',
    query: 'hearing',
    tags: ['event', 'court', 'hearing'],
    who: ['Jordan Lee', 'Avery Quinn'],
    where: ['King County'],
    whenStarted: { from: '2024-01', to: '2024-12-31' },
    whenEnded: { to: '2025' },
    top: 50,
    skip: 20,
  });
});

test('uses each selected evidence family as the required tag', () => {
  for (const family of ['claim', 'fact', 'event'] as const) {
    const input = EvidenceExplorerSearchInputSchema.parse({ families: [family] });
    assert.deepEqual(
      buildAIMIEEvidenceSearchRequest('case-123', input).tags,
      [family],
    );
  }
});

test('includes every selected evidence type as a required tag', () => {
  for (const families of [
    ['claim', 'fact'],
    ['fact', 'event'],
    ['claim', 'fact', 'event'],
  ]) {
    const input = EvidenceExplorerSearchInputSchema.parse({
      families,
      tags: ['contract'],
    });
    assert.deepEqual(
      buildAIMIEEvidenceSearchRequest('case-123', input).tags,
      [...families, 'contract'],
    );
  }
});

test('deduplicates mandatory type tags and additional tags', () => {
  const input = EvidenceExplorerSearchInputSchema.parse({
    families: ['fact', 'event', 'fact'],
    tags: ['fact', 'contract', 'contract'],
  });
  assert.deepEqual(buildAIMIEEvidenceSearchRequest('case-123', input).tags, [
    'fact', 'event', 'contract',
  ]);
});

test('requires a nonempty selection of recognized evidence types', () => {
  for (const families of [undefined, [], ['unknown'], ['claim', 'fact', 'event', 'claim']]) {
    assert.equal(
      EvidenceExplorerSearchInputSchema.safeParse({ families }).success,
      false,
    );
  }
});
