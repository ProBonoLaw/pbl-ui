'use client';
import { logger } from '@/lib/logger';
import CasePageTemplate from '@/components/cases/CasePageTemplate';
import RequestList, { RequestFilterBar, RequestRefreshButton, useRequestListFilters } from '@/components/lists/RequestList';
import { useAuth } from '@/hooks/useAuth';
import { useEventHandler } from '@/lib/notificationEvents';
import { parseRequestDataArray, RequestData } from '@/lib/types';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import AiOutputNotice from '@/components/AiOutputNotice';

export default function Page({
  params,
}: {
  params: Promise<{ case: string }>;
}) {
  const { getToken } = useAuth();
  const [caseId, setCaseId] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const filters = useRequestListFilters(requests);

  useEffect(() => {
    (async () => {
      const { case: caseId } = await params;
      logger.info('Case ID from params for argument builder:', caseId);
      setCaseId(caseId);
    })();
  }, [params]);

  const refreshArgumentBuilderRequests = useCallback(
    async (showLoading = true) => {
      if (!caseId) {
        logger.info('Loaded Argument Builder Page for case ID:', caseId);
        return;
      }

      if (showLoading) {
        setIsLoading(true);
      }

      try {
        const token = await getToken(
          process.env.NEXT_PUBLIC_AAD_API_SCOPE!.split(','),
        );
        const response = await fetch(
          `/api/accounts/cases/${caseId}/requests?requestType=argument-builder`,
          {
            method: 'GET',
            cache: 'no-store',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (response.status === 404) {
          setRequests([]);
          setLoadError(null);
          return;
        }
        if (!response.ok) throw new Error(response.statusText);

        const data = await response.json();
        logger.info('Fetched argument builder requests:', data);
        setRequests(parseRequestDataArray(data));
        setLoadError(null);
      } catch (error) {
        logger.error('Failed to fetch argument builder requests:', error);
        setLoadError('Arguments could not be refreshed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [caseId, getToken],
  );

  useEffect(() => {
    refreshArgumentBuilderRequests();
  }, [refreshArgumentBuilderRequests]);

  useEventHandler('notify:new', (event) => {
    if (event.notificationType !== 'ARGUMENT_BUILDER') {
      return;
    }

    if (event.accountId && event.accountId !== caseId) {
      return;
    }

    refreshArgumentBuilderRequests(false);
  });

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await refreshArgumentBuilderRequests(false);
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <CasePageTemplate
      title="Arguments"
      isLoading={isLoading}
      params={params}
      actionSection={
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
          <RequestFilterBar kind="argument" filters={filters} />
          <div className="ml-auto flex items-center gap-2">
            <RequestRefreshButton onClick={() => void handleRefresh()} isRefreshing={isRefreshing} disabled={isLoading || !caseId} />
            <Link
              href={`/cases/${caseId}/argument-builder/request`}
              className="inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
              Create Argument
            </Link>
          </div>
        </div>
      }
      actionNotice={<AiOutputNotice />}>
      {loadError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{loadError}</p>}
      <RequestList requests={filters.visibleRequests} totalCount={requests.length} hasFilters={filters.hasFilters} isLoading={isLoading} caseId={caseId} kind="argument" now={filters.now} onChanged={(request, action) => {
        if (action === 'delete') setRequests((current) => current.filter((entry) => entry.id !== request.id));
        else void refreshArgumentBuilderRequests(false);
      }} />
    </CasePageTemplate>
  );
}
