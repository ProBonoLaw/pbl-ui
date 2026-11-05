import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routeSource = readFileSync(
  new URL('../app/api/accounts/cases/[caseId]/requests/[requestId]/route.ts', import.meta.url),
  'utf8',
);

test('request deletion requires the generation feature before loading any request type', () => {
  const deleteHandler = routeSource.split('export async function DELETE(')[1];
  assert.ok(deleteHandler, 'DELETE handler must exist');

  const beforeLookup = deleteHandler.split('const containerName =')[0];
  assert.match(
    beforeLookup,
    /await requireUserCaseAccess\(oid, caseId, \{\s*requireIsActive: true,\s*allowInactiveGuestAccess: true,\s*requiredFeature: 'canGenerateDeclaration',\s*\}\)/,
  );
  assert.match(deleteHandler, /\['argument-builder', 'declaration', 'timeline-builder'\]/);
});
