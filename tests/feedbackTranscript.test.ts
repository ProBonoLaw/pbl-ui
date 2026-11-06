import assert from 'node:assert/strict';
import test from 'node:test';

import { decodeFeedbackTranscriptEnvelope } from '../lib/feedbackTranscript.ts';

test('decodes Base64 markdown from a feedback transcript envelope', () => {
  const markdown =
    '<!-- data-integrity-metadata: {"sourceId":"1351"} -->\n# Video analysis\n';
  const envelope = JSON.stringify({
    content: {
      '$content-type': 'application/octet-stream',
      $content: Buffer.from(markdown, 'utf-8').toString('base64'),
    },
  });

  assert.equal(
    decodeFeedbackTranscriptEnvelope(envelope),
    '# Video analysis\n',
  );
});

test('rejects a transcript envelope without Base64 content', () => {
  assert.throws(
    () => decodeFeedbackTranscriptEnvelope(JSON.stringify({ content: {} })),
    /no Base64 content/,
  );
});
