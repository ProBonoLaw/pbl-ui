'use client';

import AuthGuard from '@/components/AuthGuard';
import PageTemplate from '@/components/PageTemplate';
import {
  PrimaryListLink,
  StackedList,
  StackedListItem,
  StatusBadge,
  statusTone,
} from '@/components/lists/StackedList';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { z } from 'zod';

const SCOPES = process.env.NEXT_PUBLIC_AAD_API_SCOPE
  ? process.env.NEXT_PUBLIC_AAD_API_SCOPE.split(',').filter(Boolean)
  : ['openid', 'profile'];

const FeedbackRequestListEntrySchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  caseHeadliner: z.string().min(1),
  filename: z.string().min(1),
  status: z.enum(['pending', 'completed']),
  createdAt: z.string().min(1).optional(),
  isAccountOwned: z.boolean(),
});
const FeedbackRequestListSchema = z.array(FeedbackRequestListEntrySchema);
type FeedbackRequestListEntry = z.infer<typeof FeedbackRequestListEntrySchema>;
type FeedbackStatusFilter = FeedbackRequestListEntry['status'] | 'all';

function formatCreatedAt(createdAt?: string) {
  if (!createdAt) {
    return 'Unknown';
  }

  const date = new Date(createdAt);
  return Number.isNaN(date.valueOf()) ? createdAt : date.toLocaleString();
}

export default function FeedbackRequestsPage() {
  const { fetchWithAuth } = useAuth();
  const [requests, setRequests] = useState<FeedbackRequestListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<FeedbackStatusFilter>('all');
  const searchTerm = search.trim().toLocaleLowerCase();
  const hasFilters = searchTerm.length > 0 || status !== 'all';
  const visibleRequests = requests.filter((request) =>
    (status === 'all' || request.status === status) &&
    (!searchTerm || [request.caseHeadliner, request.filename].some((value) =>
      value.toLocaleLowerCase().includes(searchTerm))),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadRequests() {
      setLoading(true);
      try {
        const response = await fetchWithAuth(
          '/api/accounts/feedback-requests',
          { method: 'GET', cache: 'no-store' },
          SCOPES,
        );
        if (!response.ok) {
          throw new Error('Unable to load feedback requests.');
        }
        const data = FeedbackRequestListSchema.parse(await response.json());
        if (!cancelled) {
          setRequests(data);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load feedback requests.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadRequests();
    return () => {
      cancelled = true;
    };
  }, [fetchWithAuth]);

  return (
    <AuthGuard>
      <PageTemplate
        title="Feedback Center"
        isLoading={loading}
        actionSection={
          <div role="search" aria-label="Feedback request filters" className="flex min-w-0 flex-wrap items-center gap-2 pb-2">
            <input
              type="search"
              aria-label="Search feedback requests"
              placeholder="Search feedback requests..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-md bg-white px-3 py-2 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 sm:w-64 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500"
            />
            <select
              aria-label="Status"
              value={status}
              onChange={(event) => setStatus(event.target.value as FeedbackStatusFilter)}
              className="min-w-40 rounded-md bg-white px-3 py-2 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 dark:bg-gray-800 dark:text-white dark:outline-white/10">
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
            {hasFilters && (
              <button
                type="button"
                onClick={() => { setSearch(''); setStatus('all'); }}
                className="rounded-md px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-600 dark:text-indigo-400 dark:hover:bg-white/10">
                Clear filters
              </button>
            )}
          </div>
        }>
        <div>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
            Review speaker-name feedback requests for your accessible cases.
          </p>
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </p>
          )}
          {!error && (
            <>
              {!loading && hasFilters && (
                <p role="status" className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {visibleRequests.length} of {requests.length} feedback requests
                </p>
              )}
              <StackedList isLoading={loading} isEmpty={visibleRequests.length === 0} emptyMessage={hasFilters ? 'No matching feedback requests.' : 'No feedback requests are available.'}>
              {visibleRequests.map((request) => (
                <StackedListItem
                  key={request.id}
                  title="Speaker name review"
                  badge={<StatusBadge tone={statusTone(request.status)}>{request.status}</StatusBadge>}
                  description={`Case: ${request.caseHeadliner}`}
                  metadata={[
                    `File: ${request.filename}`,
                    `Requested: ${formatCreatedAt(request.createdAt)}`,
                    ...(!request.isAccountOwned ? ['Unavailable: you do not own this case.'] : []),
                  ]}
                  primaryAction={request.isAccountOwned ? (
                    <PrimaryListLink href={`/cases/${encodeURIComponent(request.accountId)}/feedback/${encodeURIComponent(request.id)}`}>
                      View
                    </PrimaryListLink>
                  ) : undefined}
                />
              ))}
            </StackedList>
            </>
          )}
        </div>
      </PageTemplate>
    </AuthGuard>
  );
}
