import assert from 'node:assert/strict';
import test from 'node:test';
import { getFeedbackSourceFilename } from '../lib/feedbackRequestPresentation.ts';

test('uses the stored input filename for feedback request presentation', () => {
  assert.equal(
    getFeedbackSourceFilename(
      { filename: 'Witness interview.mp4' },
      'Shared%2bDocuments%252fEvidence%252fother.mp4',
    ),
    'Witness interview.mp4',
  );
});

test('falls back to the decoded identifier filename', () => {
  assert.equal(
    getFeedbackSourceFilename(
      undefined,
      'Shared%2bDocuments%252fEvidence%252fVideo%2520recording.mp4',
    ),
    'Video recording.mp4',
  );
});
