import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routeSource = readFileSync(
  new URL('../app/api/accounts/cases/[caseId]/requests/route.ts', import.meta.url),
  'utf8',
);

test('generated request lists require feature access before querying requests', () => {
  assert.match(
    routeSource,
    /const summaryOnly = requestType === 'argument-builder' \|\| requestType === 'declaration'/,
  );

  const beforeQuery = routeSource.split('const container = getCosmosContainer(')[0];
  assert.match(
    beforeQuery,
    /if \(summaryOnly \|\| requestType === TIMELINE_REQUEST_TYPE\) \{\s*await requireUserCaseAccess\(oid, caseId, \{\s*requireIsActive: true,\s*allowInactiveGuestAccess: true,\s*requiredFeature: 'canGenerateDeclaration',/,
  );
});

test('unfiltered lists exclude generated request types without feature access', () => {
  const restrictedQuery = routeSource.split('else if (!canReadGeneratedRequests) {')[1];
  assert.ok(restrictedQuery, 'restricted query branch must exist');
  assert.match(restrictedQuery, /c\.type != @timelineRequestType/);
  assert.match(restrictedQuery, /c\.type != @argumentRequestType/);
  assert.match(restrictedQuery, /c\.type != @declarationRequestType/);
});
