import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_DOCUMENT_UPLOAD_REQUEST_SIZE,
  validateDocumentUploadContentLength,
} from '../lib/documentUploadLimits.ts';

test('requires a Content-Length header before parsing a document upload', () => {
  assert.deepEqual(validateDocumentUploadContentLength(null), {
    status: 411,
    error: 'Content-Length is required for document uploads.',
  });
});

test('rejects malformed and oversized document upload Content-Length headers', () => {
  assert.deepEqual(validateDocumentUploadContentLength('250MB'), {
    status: 400,
    error: 'Invalid Content-Length header.',
  });
  assert.equal(
    validateDocumentUploadContentLength(
      String(MAX_DOCUMENT_UPLOAD_REQUEST_SIZE + 1),
    )?.status,
    413,
  );
});

test('accepts a bounded document upload Content-Length header', () => {
  assert.equal(
    validateDocumentUploadContentLength(
      String(MAX_DOCUMENT_UPLOAD_REQUEST_SIZE),
    ),
    null,
  );
});
