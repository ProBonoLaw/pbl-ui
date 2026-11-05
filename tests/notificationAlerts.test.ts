import assert from 'node:assert/strict';
import test from 'node:test';

import { parseNotices } from '../lib/types.ts';

const alertNotice = {
  oid: 'oid-1',
  notificationType: 'ALERT',
  id: 'notice-1',
  data: {
    accountId: 'account-1',
    sourceId: 'source-1',
    clientFeedbackRequestId: 'feedback-request-1',
    markdownPath: 'feedback/request.md',
    status: 'FEEDBACK_REQUIRED',
  },
};

test('parses feedback-required alert notifications', () => {
  const [notice] = parseNotices([alertNotice]);

  assert.equal(notice?.notificationType, 'ALERT');
  assert.equal(notice?.data.status, 'FEEDBACK_REQUIRED');
  assert.equal(notice?.data.clientFeedbackRequestId, 'feedback-request-1');
});

test('parses feedback-requested alert notifications', () => {
  const [notice] = parseNotices([
    {
      ...alertNotice,
      data: { ...alertNotice.data, status: 'FEEDBACK_REQUESTED' },
    },
  ]);

  assert.equal(notice?.notificationType, 'ALERT');
  assert.equal(notice?.data.status, 'FEEDBACK_REQUESTED');
});

test('rejects alerts with an invalid feedback-required payload', () => {
  assert.throws(() =>
    parseNotices([
      {
        ...alertNotice,
        data: { ...alertNotice.data, status: 'SUCCESS' },
      },
    ]),
  );
});
