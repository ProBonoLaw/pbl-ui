import type { DocumentTemporalMetadata } from '@/lib/types';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function joinDateParts(parts: string[]) {
  return parts.map((part) => part.trim()).join(' ');
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function normalizeMonth(value: string | null) {
  if (!value) {
    return null;
  }

  if (/^[0-9]{1,2}$/.test(value)) {
    const monthIndex = Number(value) - 1;
    return MONTH_NAMES[monthIndex] ?? value;
  }

  return value;
}

export function formatDocumentTemporalMetadata(
  value: DocumentTemporalMetadata | null | undefined,
) {
  if (!value) {
    return null;
  }

  const year = isNonEmptyString(value.year) ? value.year.trim() : null;
  const month = normalizeMonth(
    isNonEmptyString(value.month) ? value.month.trim() : null,
  );
  const day = isNonEmptyString(value.day) ? value.day.trim() : null;
  const season = isNonEmptyString(value.season) ? value.season.trim() : null;
  const quarter = isNonEmptyString(value.quarter) ? value.quarter.trim() : null;

  if (day && month && year) {
    const dayWithSuffix = `${day},`;
    return joinDateParts([month, dayWithSuffix, year]);
  }

  if (!month && !day) {
    if (season) {
      return joinDateParts([season, year].filter(isNonEmptyString));
    }
    if (quarter) {
      return joinDateParts([quarter, year].filter(isNonEmptyString));
    }
  }

  const dateParts = [month, day, year].filter(isNonEmptyString);
  if (dateParts.length > 0) {
    return joinDateParts(dateParts);
  }

  return null;
}

export default function DocumentTemporalMetadataDate({
  value,
  fallback = 'Not available',
  className,
}: {
  value: DocumentTemporalMetadata | null | undefined;
  fallback?: string | null;
  className?: string;
}) {
  const text = formatDocumentTemporalMetadata(value) ?? fallback;

  if (!text) {
    return null;
  }

  return <span className={className}>{text}</span>;
}
