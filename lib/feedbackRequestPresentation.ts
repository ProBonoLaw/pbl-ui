function getStringProperty(value: unknown, property: string): string | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !(property in value) ||
    typeof (value as Record<string, unknown>)[property] !== 'string'
  ) {
    return null;
  }

  const result = (value as Record<string, string>)[property].trim();
  return result || null;
}

function decodeIdentifier(identifier: string): string {
  let decoded = identifier;
  for (let index = 0; index < 2; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) {
        break;
      }
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

export function getFeedbackSourceFilename(
  input: unknown,
  identifier: string,
): string {
  const inputFilename = getStringProperty(input, 'filename');
  if (inputFilename) {
    return inputFilename;
  }

  const identifierFilename = decodeIdentifier(identifier)
    .replaceAll('+', ' ')
    .split('/')
    .at(-1)
    ?.trim();
  return identifierFilename || 'Unknown file';
}
