import assert from 'node:assert/strict';
import test from 'node:test';
import { getRequestStatus } from '../lib/requestStatus.ts';
import type { RequestData } from '../lib/types.ts';

const now = Date.parse('2026-09-24T12:00:00.000Z');
const request = {
  status: 'started',
  startedAt: '2026-09-24T10:00:00.000Z',
} as RequestData;

test('a started request becomes overdue only after two hours', () => {
  assert.equal(getRequestStatus(request, now), 'started');
  assert.equal(getRequestStatus(request, now + 1), 'overdue');
  assert.equal(getRequestStatus({ ...request, startedAt: 'invalid' }, now + 1), 'started');
});

test('other statuses are never marked overdue', () => {
  for (const status of ['completed', 'failed', 'generated'] as const) {
    assert.equal(getRequestStatus({ ...request, status }, now + 1), status);
  }
});
