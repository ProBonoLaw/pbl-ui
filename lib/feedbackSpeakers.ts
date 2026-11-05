/** Extracts the unique diarization labels from a feedback markdown document. */
export function extractSpeakerLabels(markdown: string): string[] {
  const labels = new Set<string>();
  const speakerPattern = /\b(Speaker\s+\d+)\s*:/gi;

  for (const match of markdown.matchAll(speakerPattern)) {
    if (match[1]) {
      labels.add(match[1].replace(/\s+/g, ' ').trim());
    }
  }

  return [...labels].sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true }),
  );
}

/** Converts a transcript label such as "Speaker 1" to its persisted ID. */
export function getSpeakerId(label: string): string | null {
  return /^Speaker\s+(\d+)$/i.exec(label.trim())?.[1] ?? null;
}
