import assert from 'node:assert/strict';
import test from 'node:test';

import { extractSpeakerLabels, getSpeakerId } from '../lib/feedbackSpeakers.ts';
import { ClientFeedbackRequestSchema } from '../lib/types.ts';

test('extracts unique speaker labels from feedback markdown', () => {
  const labels = extractSpeakerLabels(`
- [0:00:01–0:00:04] Speaker 2: First speaker.
- [0:00:05–0:00:08] Speaker 1: Second speaker.
- [0:00:09–0:00:12] Speaker 2: First speaker again.
`);

  assert.deepEqual(labels, ['Speaker 1', 'Speaker 2']);
});

test('converts a transcript speaker label to a numeric speaker ID', () => {
  assert.equal(getSpeakerId('Speaker 1'), '1');
  assert.equal(getSpeakerId('Speaker 001'), '001');
  assert.equal(getSpeakerId('Narrator'), null);
});

test('accepts the speaker-name feedback request produced with SharePoint item IDs', () => {
  const request = ClientFeedbackRequestSchema.parse({
    id: 'feedback-request-1',
    accountId: 'account-1',
    sourceId: '555',
    identifier: 'source-unique-id',
    type: 'speakerNames',
    status: 'pending',
    input: {},
    markdownPath: 'feedback/analysis.md',
    markdownSourceId: 556,
    markdownUniqueId: 'markdown-unique-id',
  });

  assert.equal(request.sourceId, '555');
  assert.equal(request.markdownSourceId, '556');
});

test('requires both sourceId and identifier for speaker-name feedback', () => {
  const request = {
    id: 'feedback-request-required-fields',
    accountId: 'account-1',
    type: 'speakerNames',
    status: 'pending',
    markdownPath: 'feedback/analysis.md',
    markdownSourceId: '556',
  };

  assert.throws(
    () => ClientFeedbackRequestSchema.parse({ ...request, identifier: 'id' }),
    /sourceId/,
  );
  assert.throws(
    () => ClientFeedbackRequestSchema.parse({ ...request, sourceId: '555' }),
    /identifier/,
  );
});

test('requires speaker feedback to use the nested numeric speaker ID response', () => {
  const response = ClientFeedbackRequestSchema.parse({
    id: 'feedback-request-2',
    accountId: 'account-1',
    sourceId: '555',
    identifier: 'source-unique-id',
    type: 'speakerNames',
    status: 'completed',
    markdownPath: 'feedback/analysis.md',
    markdownSourceId: 556,
    response: {
      speakerNames: { 1: 'Alex Example' },
      metadata: {
        date: '2026-09-22',
        location: 'Round Rock, TX',
        description: 'Public video statement',
      },
    },
  }).response;

  assert.deepEqual(response, {
    speakerNames: { 1: 'Alex Example' },
    metadata: {
      date: '2026-09-22',
      location: 'Round Rock, TX',
      description: 'Public video statement',
    },
  });
});
