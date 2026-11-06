const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const DATA_INTEGRITY_METADATA_COMMENT =
  /^\s*<!--\s*data-integrity-metadata:\s*[\s\S]*?-->\s*/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Decodes the Base64 markdown stored in a feedback transcript envelope. */
export function decodeFeedbackTranscriptEnvelope(envelope: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(envelope);
  } catch {
    throw new Error('Feedback transcript is not a valid JSON envelope.');
  }

  if (!isRecord(parsed) || !isRecord(parsed.content)) {
    throw new Error('Feedback transcript has no content envelope.');
  }

  const encodedContent = parsed.content.$content;
  if (typeof encodedContent !== 'string') {
    throw new Error('Feedback transcript has no Base64 content.');
  }

  const normalizedContent = encodedContent.replace(/\s/g, '');
  if (!normalizedContent || !BASE64_PATTERN.test(normalizedContent)) {
    throw new Error('Feedback transcript content is not valid Base64.');
  }

  return Buffer.from(normalizedContent, 'base64')
    .toString('utf-8')
    .replace(DATA_INTEGRITY_METADATA_COMMENT, '');
}
