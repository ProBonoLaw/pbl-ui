'use client';

import ProgressModal from '@/components/qa/ProgressModal';
import RealtimeTimelinePanel from '@/components/timeline/RealtimeTimelinePanel';
import PartialTimelineResults from '@/components/timeline/PartialTimelineResults';
import TimelineResults from '@/components/timeline/TimelineResults';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';
import {
  isEventQueryPartialResult,
  parseTimelineResult,
  type EventQueryPartialResult,
  type Timeline,
} from '@/lib/types';
import { use, useEffect, useState } from 'react';

function sortTimelineEntries(entries: Timeline['entries']) {
  return [...entries].sort((left, right) => {
    const leftStartDate = left.dateRange.startDate ?? '9999-12-31';
    const rightStartDate = right.dateRange.startDate ?? '9999-12-31';
    const startDateOrder = leftStartDate.localeCompare(rightStartDate);
    return startDateOrder !== 0
      ? startDateOrder
      : (left.dateRange.endDate ?? leftStartDate).localeCompare(
        right.dateRange.endDate ?? rightStartDate,
      );
  });
}

export default function RealtimeTimelinePage({
  params,
}: Readonly<{
  params: Promise<{ case: string }>;
}>) {
  const { case: caseId } = use(params);
  const { fetchWithAuth } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [requestText, setRequestText] = useState('');
  const [includeEvents, setIncludeEvents] = useState(true);
  const [includeFacts, setIncludeFacts] = useState(true);
  const [timeline, setTimeline] = useState<
    Timeline | EventQueryPartialResult | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPartialResults, setHasPartialResults] = useState(false);
  const [showPartialResults, setShowPartialResults] = useState(false);

  useEffect(() => {
    setSessionId(crypto.randomUUID());
  }, []);

  const tags = [
    ...(includeEvents ? ['event'] : []),
    ...(includeFacts ? ['fact'] : []),
  ];

  async function buildTimeline(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = requestText.trim();
    if (!input || !caseId || !sessionId || isSubmitting || tags.length === 0) {
      return;
    }
    setError(null);
    setMessage(null);
    setTimeline(null);
    setHasPartialResults(false);
    setShowPartialResults(false);
    setIsSubmitting(true);
    try {
      const response = await fetchWithAuth(
        `/api/accounts/cases/${caseId}/timeline`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ sessionId, input, maxDocCount: 200, tags }),
        },
      );
      if (!response.ok) {
        throw new Error('The realtime timeline could not be generated.');
      }
      const parsed = parseTimelineResult(await response.json());
      if (!parsed) {
        throw new Error('The timeline service returned an invalid result.');
      }
      const isPartialResult = isEventQueryPartialResult(parsed);
      setTimeline(
        isPartialResult
          ? parsed
          : { ...parsed, entries: sortTimelineEntries(parsed.entries) },
      );
      setHasPartialResults(isPartialResult);
      setShowPartialResults(!isPartialResult);
      if (!isPartialResult) {
        setMessage(`${parsed.entries.length} timeline events generated.`);
      }
    } catch (submissionError) {
      logger.error('Realtime timeline request failed:', submissionError);
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'The timeline could not be generated. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetTimeline() {
    setSessionId(crypto.randomUUID());
    setTimeline(null);
    setMessage(null);
    setError(null);
    setHasPartialResults(false);
    setShowPartialResults(false);
  }

  return (
    <div className="space-y-6">
      <ProgressModal isLoading={isSubmitting} />
      <RealtimeTimelinePanel
        requestText={requestText}
        onRequestTextChange={setRequestText}
        includeEvents={includeEvents}
        onIncludeEventsChange={setIncludeEvents}
        includeFacts={includeFacts}
        onIncludeFactsChange={setIncludeFacts}
        isSubmitting={isSubmitting}
        isReady={Boolean(sessionId)}
        hasResults={
          Boolean(timeline) && (!hasPartialResults || showPartialResults)
        }
        onSubmit={buildTimeline}
        onReset={resetTimeline}
      />
      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}
      {hasPartialResults && (
        <div
          role="alert"
          className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-100">
          <h2 className="font-semibold">
            Timeline results could not be verified
          </h2>
          <p className="mt-1">
            The service retrieved candidate records, but could not complete its
            review. Resubmit the request for verified results. If you choose to
            view the partial list, it may be incomplete or inaccurate.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {!showPartialResults && (
              <button
                type="button"
                onClick={() => setShowPartialResults(true)}
                className="rounded-md bg-amber-800 px-3 py-2 font-semibold text-white hover:bg-amber-700 dark:bg-amber-300 dark:text-amber-950 dark:hover:bg-amber-200">
                View partial results
              </button>
            )}
            <button
              type="button"
              onClick={resetTimeline}
              className="rounded-md border border-amber-700 px-3 py-2 font-semibold text-amber-950 hover:bg-amber-100 dark:border-amber-300 dark:text-amber-100 dark:hover:bg-amber-900/60">
              Prepare to resubmit
            </button>
          </div>
        </div>
      )}
      {message && (
        <p
          role="status"
          className="rounded-md bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-200">
          {message}
        </p>
      )}
      {timeline && isEventQueryPartialResult(timeline) && showPartialResults && (
        <PartialTimelineResults records={timeline.retrievedRecords} />
      )}
      {timeline && !isEventQueryPartialResult(timeline) && (
        <TimelineResults timeline={timeline} />
      )}
    </div>
  );
}
