import type { Timeline } from '@/lib/types';
import TimelineExportActions from './TimelineExportActions';

function formatDate(date: string) {
  if (/^\d{4}$/.test(date)) {
    return date;
  }
  if (/^\d{4}-\d{2}$/.test(date)) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: 'numeric',
    }).format(new Date(`${date}-15T12:00:00`));
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

function formatDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) {
    return 'Undated';
  }
  if (!startDate) {
    return `Through ${formatDate(endDate!)}`;
  }
  if (!endDate || startDate === endDate) {
    return formatDate(startDate);
  }
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

function TimelineEntryCard({
  entry,
}: Readonly<{
  entry: Timeline['entries'][number];
}>) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
      <h3 className="font-semibold">{entry.eventType}</h3>
      <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-200">
        {entry.summary}
      </p>
      {entry.applicableSources.length > 0 && (
        <details className="mt-4 border-t border-gray-100 pt-3 text-sm dark:border-white/10">
          <summary className="cursor-pointer font-medium text-gray-800 marker:text-indigo-600 dark:text-gray-100 dark:marker:text-indigo-300">
            Sources ({entry.applicableSources.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {entry.applicableSources.map((source, sourceIndex) => (
              <li key={`${source.docId}-${sourceIndex}`}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-700 underline hover:text-indigo-500 dark:text-indigo-300">
                  Source {sourceIndex + 1}
                </a>
                {source.pages.length > 0 && (
                  <span className="text-gray-500 dark:text-gray-400">
                    {' '}
                    · Page{source.pages.length === 1 ? '' : 's'}{' '}
                    {source.pages.join(', ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

export default function TimelineResults({
  timeline,
}: Readonly<{
  timeline: Timeline;
}>) {
  return (
    <section aria-labelledby="timeline-results" className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="timeline-results" className="text-lg font-semibold">
            Timeline results
          </h2>
          <TimelineExportActions timeline={timeline} />
        </div>
        {timeline.summary && (
          <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-200">
            {timeline.summary}
          </p>
        )}
        {timeline.timeRange && (
          <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
            {formatDateRange(
              timeline.timeRange.startDate,
              timeline.timeRange.endDate,
            )}
          </p>
        )}
      </div>
      <ol className="space-y-5">
        {timeline.entries.map((entry, entryIndex) => (
          <li
            key={`${entry.dateRange.startDate}-${entryIndex}`}
            className="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3 gap-y-2 lg:grid-cols-[minmax(7rem,14rem)_1.25rem_minmax(0,1fr)] lg:gap-x-4 lg:gap-y-0">
            <time className="col-span-2 text-left text-sm font-medium text-indigo-700 dark:text-indigo-300 lg:col-span-1 lg:pt-5 lg:text-right">
              {formatDateRange(
                entry.dateRange.startDate,
                entry.dateRange.endDate,
              )}
            </time>
            <div className="relative row-start-2 lg:row-auto" aria-hidden="true">
              {entryIndex < timeline.entries.length - 1 && (
                <span className="absolute top-5 bottom-[-1.25rem] left-1/2 w-0.5 -translate-x-1/2 bg-indigo-200 dark:bg-indigo-500/40" />
              )}
              <span className="absolute top-5 left-1/2 size-3 -translate-x-1/2 rounded-full border-2 border-white bg-indigo-600 dark:border-gray-950" />
            </div>
            <TimelineEntryCard entry={entry} />
          </li>
        ))}
      </ol>
      {timeline.footnotes.length > 0 && (
        <section aria-labelledby="timeline-footnotes" className="space-y-3">
          <div>
            <h3 id="timeline-footnotes" className="text-base font-semibold">
              Additional notes
            </h3>
          </div>
          <ul className="space-y-3">
            {timeline.footnotes.map((entry, entryIndex) => (
              <li key={`${entry.eventType}-${entryIndex}`}>
                <TimelineEntryCard entry={entry} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
