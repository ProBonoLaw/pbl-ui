'use client';

import { useEffect, useState } from 'react';
import type { RequestData } from '@/lib/types';
import { getRequestStatus, type DisplayRequestStatus } from '@/lib/requestStatus';
import { useRequestActions } from './useRequestActions';
import RequestDeleteDialog from './RequestDeleteDialog';
import {
  PrimaryListLink,
  StackedList,
  StackedListItem,
  StatusBadge,
  statusTone,
} from './StackedList';

type StatusFilter = DisplayRequestStatus | 'all';

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'started', label: 'Started' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'generated', label: 'Generated' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

export function useRequestListFilters(requests: RequestData[]) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const searchTerm = search.trim().toLocaleLowerCase();
  const hasFilters = searchTerm.length > 0 || status !== 'all';
  const visibleRequests = requests.filter((request) =>
    (status === 'all' || getRequestStatus(request, now) === status) &&
    (!searchTerm || request.input.toLocaleLowerCase().includes(searchTerm)),
  );

  return {
    search,
    setSearch,
    status,
    setStatus,
    hasFilters,
    visibleRequests,
    now,
    clearFilters: () => { setSearch(''); setStatus('all'); },
  };
}

type RequestFilters = ReturnType<typeof useRequestListFilters>;

export function RequestRefreshButton({ onClick, isRefreshing, disabled }: {
  onClick: () => void;
  isRefreshing: boolean;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isRefreshing}
      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20">
      {isRefreshing ? 'Refreshing…' : 'Refresh'}
    </button>
  );
}

export function RequestFilterBar({ kind, filters }: { kind: 'argument' | 'declaration'; filters: RequestFilters }) {
  const plural = kind === 'argument' ? 'arguments' : 'declarations';
  return (
    <div role="search" aria-label={`${plural} filters`} className="flex min-w-0 flex-wrap items-center gap-2">
      <input
        type="search"
        aria-label={`Search ${plural}`}
        value={filters.search}
        onChange={(event) => filters.setSearch(event.target.value)}
        placeholder={`Search ${plural}...`}
        className="w-full rounded-md bg-white px-3 py-2 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 sm:w-64 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500"
      />
      <select
        aria-label="Status"
        value={filters.status}
        onChange={(event) => filters.setStatus(event.target.value as StatusFilter)}
        className="min-w-40 rounded-md bg-white px-3 py-2 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 dark:bg-gray-800 dark:text-white dark:outline-white/10">
        {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {filters.hasFilters && (
        <button type="button" onClick={filters.clearFilters} className="rounded-md px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-600 dark:text-indigo-400 dark:hover:bg-white/10">
          Clear filters
        </button>
      )}
    </div>
  );
}

export default function RequestList({
  requests,
  totalCount,
  hasFilters,
  isLoading,
  caseId,
  kind,
  now,
  onChanged,
}: {
  requests: RequestData[];
  totalCount: number;
  hasFilters: boolean;
  isLoading: boolean;
  caseId: string | null;
  kind: 'argument' | 'declaration';
  now: number;
  onChanged: (request: RequestData, action: 'delete' | 'resubmit') => void | Promise<void>;
}) {
  const plural = kind === 'argument' ? 'arguments' : 'declarations';
  const route = kind === 'argument' ? 'argument-builder' : 'declarations';
  const { busyId, actionMessage, actionError, pendingDelete, requestDelete, cancelDelete, confirmDelete, runAction } = useRequestActions(caseId, onChanged);

  return (
    <div className="w-full">
      <RequestDeleteDialog request={pendingDelete} onConfirm={confirmDelete} onCancel={cancelDelete} />
      {actionError && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{actionError}</p>}
      {actionMessage && <p role="status" className="mt-3 text-sm text-green-700 dark:text-green-300">{actionMessage}</p>}
      {!isLoading && hasFilters && (
        <p role="status" className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          Showing {requests.length} of {totalCount} {plural}
        </p>
      )}
      <StackedList isLoading={isLoading} isEmpty={requests.length === 0} emptyMessage={hasFilters ? `No matching ${plural}.` : `No ${plural} yet.`}>
        {requests.map((entry) => (
          <StackedListItem
            key={entry.id}
            title={entry.input || (kind === 'argument' ? 'Argument' : 'Declaration')}
            badge={<StatusBadge tone={statusTone(getRequestStatus(entry, now))}>{getRequestStatus(entry, now)}</StatusBadge>}
            metadata={[
              `Started ${new Date(entry.startedAt).toLocaleString('en-US')}`,
              entry.endedAt ? `Ended ${new Date(entry.endedAt).toLocaleString('en-US')}` : 'In progress',
            ]}
            primaryAction={entry.status === 'completed' ? <PrimaryListLink href={`/cases/${caseId}/${route}/${entry.id}`}>View</PrimaryListLink> : undefined}
            menuLabel={`Actions for ${kind} ${entry.input || entry.id}`}
            menuActions={[
              { label: busyId === entry.id ? 'Working…' : 'Resubmit', disabled: Boolean(busyId) || !entry.input.trim(), onClick: () => void runAction(entry, 'resubmit') },
              { label: 'Delete', disabled: Boolean(busyId), onClick: () => requestDelete(entry) },
            ]}
          />
        ))}
      </StackedList>
    </div>
  );
}
