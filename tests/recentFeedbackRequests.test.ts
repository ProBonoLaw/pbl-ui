import assert from 'node:assert/strict';
import test from 'node:test';
import { findRecentPendingFeedbackRequest } from '../lib/recentFeedbackRequests.ts';

const now = new Date('2026-09-22T12:00:00.000Z');

test('finds an owned pending feedback request created within three days', () => {
  const request = findRecentPendingFeedbackRequest(
    [
      {
        id: 'recent-request',
        accountId: 'case-1',
        status: 'pending',
        createdAt: '2026-09-20T12:00:00.000Z',
        isAccountOwned: true,
      },
    ],
    now,
  );

  assert.equal(request?.id, 'recent-request');
});

test('excludes completed, inaccessible, and expired feedback requests', () => {
  const request = findRecentPendingFeedbackRequest(
    [
      {
        id: 'completed',
        accountId: 'case-1',
        status: 'completed',
        createdAt: '2026-09-22T11:00:00.000Z',
        isAccountOwned: true,
      },
      {
        id: 'inaccessible',
        accountId: 'case-2',
        status: 'pending',
        createdAt: '2026-09-22T11:00:00.000Z',
        isAccountOwned: false,
      },
      {
        id: 'expired',
        accountId: 'case-3',
        status: 'pending',
        createdAt: '2026-09-19T11:59:59.000Z',
        isAccountOwned: true,
      },
      {
        id: 'three-days-old',
        accountId: 'case-4',
        status: 'pending',
        createdAt: '2026-09-19T12:00:00.000Z',
        isAccountOwned: true,
      },
    ],
    now,
  );

  assert.equal(request, null);
});
