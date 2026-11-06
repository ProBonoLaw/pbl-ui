import assert from 'node:assert/strict';
import test from 'node:test';

import { createFileIngestionRequest } from '../lib/fileIngestionRequest.ts';

test('creates the forced file-ingestion request for speaker feedback', () => {
  assert.deepEqual(
    createFileIngestionRequest({
      identifier: 'source-unique-id',
      accountId: 'case-123',
    }),
    {
      eventKind: 'FileIngestion',
      isFolder: false,
      identifier: 'source-unique-id',
      accountId: 'case-123',
      highRes: false,
      force: true,
    },
  );
});
