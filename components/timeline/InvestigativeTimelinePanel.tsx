'use client';

import type { RequestData } from '@/lib/types';
import TimelineAccordion from '@/components/timeline/TimelineAccordion';
import { PrimaryListLink, StackedList, StackedListItem, StatusBadge, statusTone } from '@/components/lists/StackedList';
import { useRequestActions } from '@/components/lists/useRequestActions';
import RequestDeleteDialog from '@/components/lists/RequestDeleteDialog';
import { getRequestStatus } from '@/lib/requestStatus';
import { FormActions, FormSection } from '@/components/forms/FormSection';
import { useEffect, useState, type FormEvent } from 'react';

export default function InvestigativeTimelinePanel({
  requestText,
  onRequestTextChange,
  isSubmitting,
  isReady,
  hasResults,
  onSubmit,
  onReset,
  requests,
  activeRequestId,
  isLoadingRequests,
  onRefresh,
  caseId,
  onChanged,
}: Readonly<{
  requestText: string;
  onRequestTextChange: (value: string) => void;
  isSubmitting: boolean;
  isReady: boolean;
  hasResults: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
  requests: RequestData[];
  activeRequestId: string | null;
  isLoadingRequests: boolean;
  onRefresh: () => void;
  caseId: string;
  onChanged: (request: RequestData, action: 'delete' | 'resubmit') => void | Promise<void>;
}>) {
  const [isPastTimelinesOpen, setIsPastTimelinesOpen] = useState(!hasResults);
  const [now, setNow] = useState(() => Date.now());
  const { busyId, actionMessage, actionError, pendingDelete, requestDelete, cancelDelete, confirmDelete, runAction } = useRequestActions(caseId, onChanged);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setIsPastTimelinesOpen(!hasResults);
  }, [hasResults]);

  return (
    <div className="space-y-6">
      <RequestDeleteDialog request={pendingDelete} onConfirm={confirmDelete} onCancel={cancelDelete} />
      <TimelineAccordion
        title="Build investigative timeline"
        description="Add instructions to queue a deeper Timeline Builder review."
        defaultOpen={!hasResults}
        collapseWhen={hasResults}>
        <form
          onSubmit={onSubmit}
          className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
          <FormSection title="Timeline Instructions" description="Describe the review you want to run.">
            <div className="col-span-full">
              <label
                htmlFor="investigative-timeline-request"
                className="text-sm font-semibold">
                Timeline instructions
              </label>
              <textarea
                id="investigative-timeline-request"
                value={requestText}
                onChange={(event) => onRequestTextChange(event.target.value)}
                rows={4}
                required
                disabled={isSubmitting}
                className="mt-2 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>
          </FormSection>
          <FormActions>
            <button
              type="button"
              onClick={onReset}
              disabled={isSubmitting}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20">
              Reset
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isReady}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300">
              {isSubmitting
                ? 'Starting investigative timeline…'
                : 'Start investigative timeline'}
            </button>
          </FormActions>
        </form>
      </TimelineAccordion>

      <section
        aria-labelledby="past-investigative-timelines"
        className="rounded-xl border border-gray-200 p-5 dark:border-white/10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2
              id="past-investigative-timelines"
              className="text-lg font-semibold">
              Past investigative timelines
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Reopen completed Timeline Builder executions for this case.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoadingRequests}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10">
            Refresh
          </button>
        </div>

        <details
          open={isPastTimelinesOpen}
          onToggle={(event) => setIsPastTimelinesOpen(event.currentTarget.open)}
          className="mt-4 rounded-lg border border-gray-200 dark:border-white/10">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-white/5">
            {isPastTimelinesOpen
              ? 'Hide past investigative timelines'
              : 'Show past investigative timelines'}
          </summary>
          <div className="border-t border-gray-200 px-5 pb-5 dark:border-white/10">
            {actionError && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{actionError}</p>}
            {actionMessage && <p role="status" className="mt-4 text-sm text-green-700 dark:text-green-300">{actionMessage}</p>}
            <StackedList isLoading={isLoadingRequests} isEmpty={requests.length === 0} emptyMessage="No investigative timelines have been submitted yet.">
              {requests.map((request) => (
                <StackedListItem
                  key={request.id}
                  title={request.input || 'Investigative timeline'}
                  badge={<StatusBadge tone={statusTone(getRequestStatus(request, now))}>{getRequestStatus(request, now)}</StatusBadge>}
                  metadata={[`Started ${new Date(request.startedAt).toLocaleString('en-US')}`, request.id === activeRequestId ? 'Currently open' : '']}
                  primaryAction={request.status === 'completed' ? <PrimaryListLink href={`/cases/${caseId}/timeline/investigative/${encodeURIComponent(request.id)}`}>View</PrimaryListLink> : undefined}
                  menuLabel={`Actions for timeline ${request.input || request.id}`}
                  menuActions={[
                    { label: busyId === request.id ? 'Working…' : 'Resubmit', disabled: Boolean(busyId) || !request.input.trim(), onClick: () => void runAction(request, 'resubmit') },
                    { label: 'Delete', disabled: Boolean(busyId), onClick: () => requestDelete(request) },
                  ]}
                />
              ))}
            </StackedList>
          </div>
        </details>
      </section>
    </div>
  );
}
