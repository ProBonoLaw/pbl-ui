import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRequestSummaries, REQUEST_SUMMARY_SELECT } from '../lib/requestSummaries.ts';
import { parseRequestDataArray } from '../lib/types.ts';

test('list projection excludes large request fields while keeping row and action fields', () => {
  const summary = parseRequestSummaries([{
    id: 'request-1',
    accountId: 'case-1',
    sessionId: 'session-1',
    input: 'Draft an argument',
    type: 'argument-builder',
    status: 'completed',
    oid: 'owner-1',
    startedAt: '2026-09-24T10:00:00.000Z',
    endedAt: '2026-09-24T10:01:00.000Z',
    output: 'large output',
    contents: [{ data: 'large contents' }],
  }])[0];

  assert.equal(summary.id, 'request-1');
  assert.equal(summary.input, 'Draft an argument');
  assert.equal(summary.sessionId, 'session-1');
  assert.equal(summary.endedAt, '2026-09-24T10:01:00.000Z');
  assert.equal(Object.hasOwn(summary, 'output'), false);
  assert.equal(Object.hasOwn(summary, 'contents'), false);
  assert.equal(REQUEST_SUMMARY_SELECT.includes('output'), false);
  assert.equal(REQUEST_SUMMARY_SELECT.includes('contents'), false);
  assert.equal(parseRequestDataArray([summary])[0].id, 'request-1');
});

test('request parsing accepts in-progress timestamps with a UTC offset and null end time', () => {
  const request = {
    id: 'request-2',
    accountId: 'case-1',
    sessionId: 'session-1',
    input: 'Build a timeline',
    type: 'timeline-builder',
    status: 'started',
    oid: 'owner-1',
    startedAt: '2026-10-05T21:25:08.5588205+00:00',
    endedAt: null,
  };

  const parsed = parseRequestDataArray([request])[0];
  assert.equal(parsed.startedAt, request.startedAt);
  assert.equal(parsed.endedAt, undefined);
  assert.equal(parseRequestSummaries([request])[0].endedAt, undefined);
});
