'use client';

import LoadingState from '@/components/LoadingState';
import ModalDialog from '@/components/ModalDialog';
import ProgressModal from '@/components/qa/ProgressModal';
import InvestigativeTimelinePanel from '@/components/timeline/InvestigativeTimelinePanel';
import TimelineResults from '@/components/timeline/TimelineResults';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';
import { useEventHandler } from '@/lib/notificationEvents';
import {
  parseRequestDataArray,
  parseTimelineResult,
  type RequestData,
  type Timeline,
} from '@/lib/types';
import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useState } from 'react';

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

export default function InvestigativeTimelinePage({
  params,
  requestId,
}: Readonly<{
  params: Promise<{ case: string }>;
  requestId?: string;
}>) {
  const { case: caseId } = use(params);
  const { fetchWithAuth } = useAuth();
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [requestText, setRequestText] = useState('');
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmittedModal, setShowSubmittedModal] = useState(false);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(
    Boolean(requestId),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestData[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);

  const refreshRequests = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setIsLoadingRequests(true);
      }
      try {
        const response = await fetchWithAuth(
          `/api/accounts/cases/${caseId}/requests?requestType=timeline-builder`,
          { method: 'GET', cache: 'no-store' },
        );
        if (response.status === 404) {
          setRequests([]);
          return;
        }
        if (!response.ok) {
          throw new Error('Past investigative timelines could not be loaded.');
        }
        setRequests(parseRequestDataArray(await response.json()));
      } catch (historyError) {
        logger.error('Timeline history request failed:', historyError);
        setError('Past investigative timelines could not be loaded.');
      } finally {
        setIsLoadingRequests(false);
      }
    },
    [caseId, fetchWithAuth],
  );

  useEffect(() => {
    setSessionId(crypto.randomUUID());
    void refreshRequests();
  }, [refreshRequests]);

  useEventHandler('notify:new', (event) => {
    if (
      event.notificationType === 'TIMELINE_BUILDER' &&
      (!event.accountId || event.accountId === caseId)
    ) {
      void refreshRequests(false);
    }
  });

  useEffect(() => {
    if (!requestId) {
      setTimeline(null);
      setIsLoadingTimeline(false);
      return;
    }

    let cancelled = false;
    setTimeline(null);
    setError(null);
    setMessage(null);
    setIsLoadingTimeline(true);
    (async () => {
      try {
        const response = await fetchWithAuth(
          `/api/accounts/cases/${caseId}/requests/${requestId}`,
          { method: 'GET', cache: 'no-store' },
        );
        if (!response.ok) {
          throw new Error('The investigative timeline could not be loaded.');
        }
        const requestItem = parseRequestDataArray([await response.json()])[0];
        if (!requestItem || requestItem.type !== 'timeline-builder') {
          throw new Error(
            'The saved request is not an investigative timeline.',
          );
        }
        if (requestItem.status === 'failed') {
          if (!cancelled) {
            setError(
              'This investigative timeline failed to generate. Please try again.',
            );
          }
          return;
        }
        if (!requestItem.output) {
          if (!cancelled) {
            setMessage('This investigative timeline is still being processed.');
          }
          return;
        }
        const parsed = parseTimelineResult(requestItem.output);
        if (!parsed) {
          throw new Error(
            'The saved investigative timeline has an invalid result.',
          );
        }
        if (!cancelled) {
          setTimeline({
            ...parsed,
            entries: sortTimelineEntries(parsed.entries),
          });
          setMessage('Investigative timeline loaded.');
        }
      } catch (loadError) {
        logger.error('Timeline Builder execution lookup failed:', loadError);
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'The investigative timeline could not be loaded.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTimeline(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [caseId, fetchWithAuth, requestId]);

  async function submitTimeline(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestTextValue = requestText.trim();
    if (!requestTextValue || !sessionId || isSubmitting) {
      return;
    }
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetchWithAuth(
        `/api/accounts/cases/${caseId}/timeline/submit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, requestText: requestTextValue }),
        },
      );
      if (!response.ok) {
        throw new Error('The investigative timeline could not be submitted.');
      }
      setRequestText('');
      setShowSubmittedModal(true);
    } catch (submissionError) {
      logger.error('Investigative timeline request failed:', submissionError);
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'The investigative timeline could not be submitted.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetTimeline() {
    setSessionId(crypto.randomUUID());
    setRequestText('');
    setTimeline(null);
    setMessage(null);
    setError(null);
    if (requestId) {
      router.push(`/cases/${caseId}/timeline/investigative`);
    }
  }

  function dismissSubmittedModal() {
    setShowSubmittedModal(false);
    void refreshRequests(false);
  }

  if (isLoadingTimeline) {
    return (
      <LoadingState
        title="Loading investigative timeline"
        message="Retrieving the saved Timeline Builder result."
        fullHeight
      />
    );
  }

  return (
    <div className="space-y-6">
      <ProgressModal isLoading={isSubmitting} />
      {showSubmittedModal && (
        <ModalDialog
          title="Investigative Timeline Submitted"
          opened={true}
          submitText="OK"
          cancelText={null}
          onApproved={dismissSubmittedModal}>
          Your investigative timeline has been submitted. You will be notified
          when it is ready.
        </ModalDialog>
      )}
      <InvestigativeTimelinePanel
        requestText={requestText}
        onRequestTextChange={setRequestText}
        isSubmitting={isSubmitting}
        isReady={Boolean(sessionId)}
        hasResults={Boolean(timeline)}
        onSubmit={submitTimeline}
        onReset={resetTimeline}
        requests={requests}
        activeRequestId={requestId ?? null}
        isLoadingRequests={isLoadingRequests}
        onRefresh={() => void refreshRequests()}
        caseId={caseId}
        onChanged={(request, action) => {
          if (action === 'delete') {
            setRequests((current) => current.filter((entry) => entry.id !== request.id));
            if (requestId === request.id) router.push(`/cases/${caseId}/timeline/investigative`);
          } else {
            void refreshRequests(false);
          }
        }}
      />
      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-md bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-200">
          {message}
        </p>
      )}
      {timeline && <TimelineResults timeline={timeline} />}
    </div>
  );
}
