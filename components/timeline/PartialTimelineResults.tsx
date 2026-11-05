type CandidateRecord = Record<string, unknown>;

function isCandidateRecord(value: unknown): value is CandidateRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asTextList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.flatMap((item) => (asText(item) ? [asText(item)!] : []))
    : [];
}

function formatCandidateDateRange(value: unknown): string | null {
  if (!isCandidateRecord(value)) {
    return null;
  }

  const startDate = asText(value.startDate);
  const endDate = asText(value.endDate);
  if (!startDate && !endDate) {
    return null;
  }
  if (!startDate) {
    return `Through ${endDate}`;
  }
  if (!endDate || startDate === endDate) {
    return startDate;
  }
  return `${startDate} – ${endDate}`;
}

function asSafeUrl(value: unknown): string | null {
  const url = asText(value);
  if (!url) {
    return null;
  }

  try {
    const protocol = new URL(url).protocol;
    return protocol === 'http:' || protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function CandidateRecordCard({
  record,
  index,
}: Readonly<{
  record: unknown;
  index: number;
}>) {
  if (!isCandidateRecord(record)) {
    return (
      <article className="rounded-xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-500/50 dark:bg-amber-950/30">
        <h3 className="font-semibold">Candidate record {index + 1}</h3>
        <p className="mt-2 text-sm text-amber-950 dark:text-amber-100">
          This retrieved record has an unsupported format.
        </p>
      </article>
    );
  }

  const title =
    asText(record.title) ?? asText(record.what) ?? `Candidate record ${index + 1}`;
  const content = asText(record.content) ?? asText(record.what);
  const dateRange = formatCandidateDateRange(record.dateRange);
  const people = asTextList(record.who);
  const tags = asTextList(record.tags);
  const pages = asTextList(record.pages);
  const sourceUrl = asSafeUrl(record.url);

  return (
    <article className="rounded-xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-500/50 dark:bg-amber-950/30">
      <h3 className="font-semibold">{title}</h3>
      {dateRange && (
        <p className="mt-1 text-sm text-amber-950 dark:text-amber-100">
          {dateRange}
        </p>
      )}
      {content && (
        <p className="mt-2 text-sm leading-6 text-amber-950 dark:text-amber-100">
          {content}
        </p>
      )}
      {(people.length > 0 || tags.length > 0 || sourceUrl || pages.length > 0) && (
        <dl className="mt-4 space-y-1 border-t border-amber-300 pt-3 text-sm dark:border-amber-500/50">
          {people.length > 0 && (
            <div>
              <dt className="inline font-semibold">People: </dt>
              <dd className="inline">{people.join(', ')}</dd>
            </div>
          )}
          {tags.length > 0 && (
            <div>
              <dt className="inline font-semibold">Tags: </dt>
              <dd className="inline">{tags.join(', ')}</dd>
            </div>
          )}
          {(sourceUrl || pages.length > 0) && (
            <div>
              <dt className="inline font-semibold">Source: </dt>
              <dd className="inline">
                {sourceUrl ? (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline">
                    View source
                  </a>
                ) : (
                  'No source link'
                )}
                {pages.length > 0 && ` · Page${pages.length === 1 ? '' : 's'} ${pages.join(', ')}`}
              </dd>
            </div>
          )}
        </dl>
      )}
    </article>
  );
}

export default function PartialTimelineResults({
  records,
}: Readonly<{
  records: unknown[];
}>) {
  return (
    <section aria-labelledby="partial-timeline-results" className="space-y-4">
      <div>
        <h2 id="partial-timeline-results" className="text-lg font-semibold">
          Unverified candidate records
        </h2>
        <p className="mt-2 text-sm leading-6 text-amber-900 dark:text-amber-100">
          These records were retrieved but not verified by the timeline review.
        </p>
      </div>
      {records.length > 0 ? (
        <ol className="space-y-4">
          {records.map((record, index) => (
            <li key={index}>
              <CandidateRecordCard record={record} index={index} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-amber-900 dark:text-amber-100">
          No candidate records were returned.
        </p>
      )}
    </section>
  );
}
