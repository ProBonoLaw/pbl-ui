import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isEventQueryPartialResult,
  parseNotices,
  parseTimelineResult,
  QAInteractionSlimModel,
  TimelineDateRangeSchema,
  TimelineEntryDateRangeSchema,
} from '../lib/types.ts';

test('parses QA exhibits with array document metadata and missing full-document fields', () => {
  const parsed = QAInteractionSlimModel.parse({
    document: 'Answer text',
    exhibits: [
      {
        firstIndex: 1,
        doc: {
          docId: 'doc-1',
          sourceUrl: 'https://example.test/doc-1.pdf',
          pages: [1, 2],
          who: ['Client', 'Witness'],
        },
      },
    ],
  });

  assert.deepEqual(parsed.data.exhibits[0]?.doc.who, ['Client', 'Witness']);
});

test('accepts timeline dates at year, month, and day precision', () => {
  assert.deepEqual(TimelineDateRangeSchema.parse({ startDate: '2013' }), {
    startDate: '2013',
    endDate: '2013',
  });
  assert.deepEqual(TimelineDateRangeSchema.parse({ startDate: '0001-01-01' }), {
    startDate: '0001-01-01',
    endDate: '0001-01-01',
  });
  assert.deepEqual(
    TimelineEntryDateRangeSchema.parse({
      startDate: '2020-02',
      endDate: '2020-02-29',
    }),
    { startDate: '2020-02', endDate: '2020-02-29' },
  );
  assert.deepEqual(
    TimelineEntryDateRangeSchema.parse({
      startDate: '2025-01-31',
      endDate: null,
    }),
    { startDate: '2025-01-31', endDate: '2025-01-31' },
  );
});

test('parses a completed investigative timeline orchestration output', () => {
  const timeline = parseTimelineResult({
    name: 'TimelineOrchestration',
    runtimeStatus: 'Completed',
    output: {
      sessionId: 'timeline-session-1',
      accountId: 'account-1',
      originalRequest: 'Generate a timeline of the case.',
      summary: 'A sourced timeline of the case.',
      timeRange: { startDate: '2020-01-01', endDate: '2020-01-02' },
      entries: [
        {
          dateRange: { startDate: null, endDate: null },
          eventType: 'Undated record',
          summary: 'The source did not provide an event date.',
          applicableSources: [
            {
              docId: 'doc-1',
              sourceId: '1',
              url: 'https://example.test/document',
              pages: [1],
            },
            { docId: '', sourceId: '2', url: 'not a URL', pages: [] },
            {
              docId: 'doc-unsafe',
              sourceId: '3',
              url: 'javascript:alert(1)',
              pages: [],
            },
          ],
        },
      ],
      timeToCompletionSeconds: 728.178,
    },
  });

  assert.ok(timeline);
  assert.equal(timeline.summary, 'A sourced timeline of the case.');
  assert.equal(timeline.timeToCompletionSeconds, 728.178);
  assert.deepEqual(timeline.tags, []);
  assert.equal(timeline.entries[0]?.dateRange.startDate, null);
  assert.equal(timeline.entries[0]?.applicableSources.length, 1);
  assert.equal(
    timeline.entries[0]?.applicableSources[0]?.url,
    'https://example.test/document',
  );
});

test('preserves and identifies an unverified partial event query result', () => {
  const timeline = parseTimelineResult({
    sessionId: 'timeline-session-2',
    accountId: 'account-1',
    tags: ['event'],
    originalRequest: 'Show the case events.',
    timeRange: { startDate: null, endDate: null },
    entries: [],
    footnotes: [],
    code: 'EVENT_QUERY_PARTIAL_RESULT',
    message: 'Candidate records could not be model-reviewed.',
    retrievalStatus: 'succeeded',
    reviewStatus: 'incomplete',
    retrievedRecordCount: 1,
    retrievedRecords: [
      {
        recordIndex: 0,
        docId: 'doc-1',
        sourceId: 'source-1',
        title: 'Candidate record',
        url: null,
        pages: ['4'],
        tags: ['event'],
        where: null,
        what: 'A candidate event',
        who: ['Client'],
        why: null,
        dateRange: { startDate: '2026-01-01', endDate: null },
        content: 'Unverified candidate content.',
      },
    ],
    failureReasons: ['timeout'],
  });

  assert.ok(timeline);
  assert.ok(isEventQueryPartialResult(timeline));
  assert.equal(timeline.retrievedRecordCount, 1);
  assert.deepEqual(timeline.failureReasons, ['timeout']);
});

test('ignores Cosmos DB system metadata on strict timeline notifications', () => {
  const notices = parseNotices([
    {
      oid: 'oid-1',
      notificationType: 'TIMELINE_BUILDER',
      id: 'notice-1',
      read: false,
      createdAt: '2026-09-15T18:51:34.542Z',
      data: {
        accountId: 'account-1',
        sessionId: 'session-1',
        status: 'SUCCESS',
      },
      _rid: 'cosmos-rid',
      _self: 'cosmos-self',
      _etag: 'cosmos-etag',
      _attachments: 'attachments/',
      _ts: 1789498295,
    },
  ]);

  assert.equal(notices.length, 1);
  assert.equal(notices[0]?.notificationType, 'TIMELINE_BUILDER');
});
