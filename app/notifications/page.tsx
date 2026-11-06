'use client';
import { logger } from '@/lib/logger';
import PageTemplate from '@/components/PageTemplate';
import { PrimaryListLink, StackedList, StackedListItem, StatusBadge } from '@/components/lists/StackedList';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { ResponsiveAccordion } from '@/components/ResponsiveAccordion';
import { useAuth } from '@/hooks/useAuth';
import { emitNotification, useEventHandler } from '@/lib/notificationEvents';
import {
  CaseCreatedNotice,
  CaseDeletedNotice,
  ArgumentBuilderNotice,
  DeclarationNotice,
  Notice,
  parseNotices,
  DocumentIngestionNotice,
  DocumentEgestionNotice,
  NotificationType,
  NotificationTypeSchema,
} from '@/lib/types';
import {
  Label,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from '@headlessui/react';
import { ChevronUpDownIcon } from '@heroicons/react/24/outline';
import { Trash2Icon } from 'lucide-react';
import { useEffect, useState } from 'react';

const SCOPES = process.env.NEXT_PUBLIC_AAD_API_SCOPE
  ? process.env.NEXT_PUBLIC_AAD_API_SCOPE.split(',').filter(Boolean)
  : ['openid', 'profile'];
export default function NotificationsPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [filteredNotices, setFilteredNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isDeletingAll, setIsDeletingAll] = useState<boolean>(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] =
    useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [includeDeleted, setIncludeDeleted] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string | undefined>();
  const [notificationTypeFilter, setNotificationTypeFilter] = useState<
    NotificationType | undefined
  >(undefined);
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const { fetchWithAuth } = useAuth();

  const refreshNotices = async () => {
    logger.info('Fetching notifications...');
    setLoading(true);
    const baseUrl = '/api/accounts/notifications';
    const url = includeDeleted ? `${baseUrl}?includeDeleted=true` : baseUrl;
    try {
      const response = await fetchWithAuth(
        url,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        SCOPES,
      );
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.error('Failed to fetch notifications:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
        });
        setFetchError(
          'Unable to load notifications right now. Please try again.',
        );
        return;
      }
      const data = await response.json();
      const noticeData = parseNotices(data.data);
      setNotices(noticeData);
      setFetchError(null);
    } catch (error) {
      logger.error('Error fetching notifications:', error);
      setFetchError(
        'Unable to load notifications right now. Please try again.',
      );
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    logger.info('Initial load of notifications');
    refreshNotices();
  }, [includeDeleted, fetchWithAuth]);

  useEffect(() => {
    if (!isRefreshing) {
      return;
    }

    refreshNotices();
  }, [isRefreshing, includeDeleted, fetchWithAuth]);

  useEventHandler('notify:new', () => {
    logger.info('New notification event received, refreshing notices...');
    setIsRefreshing((prev) => (prev ? prev : true));
  });

  useEventHandler('notify:read', ({ id, notificationType }) => {
    setNotices((current) => current.map((entry) =>
      entry.id === id && entry.notificationType === notificationType
        ? { ...entry, read: true, readAt: entry.readAt ?? new Date() }
        : entry,
    ));
  });

  const readHandler = async (notice: Notice) => {
    try {
      const response = await fetchWithAuth(
        `/api/accounts/notifications/${notice.id}?notificationType=${notice.notificationType}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ readAt: new Date() }),
        },
        SCOPES,
      );
      if (!response.ok) {
        logger.error('Failed to mark notification as read:', response.status);
        return;
      }
      emitNotification('notify:read', {
        id: notice.id,
        notificationType: notice.notificationType,
      });
    } catch (error) {
      logger.error('Error marking notification as read:', error);
    }
  };

  function iconHref(notice: Notice) {
    switch (notice.notificationType) {
      case 'DECLARATION':
        return notice.data.requestId
          ? `/cases/${notice.data.accountId}/declarations/${notice.data.requestId}`
          : '#';
      case 'ARGUMENT_BUILDER':
        return notice.data.requestId
          ? `/cases/${notice.data.accountId}/argument-builder/${notice.data.requestId}`
          : '#';
      case 'TIMELINE_BUILDER':
        return notice.data.requestId
          ? `/cases/${notice.data.accountId}/timeline/investigative/${encodeURIComponent(notice.data.requestId)}`
          : `/cases/${notice.data.accountId}/timeline/investigative`;
      case 'CASE_CREATED':
        const caseCreatedNotice = notice as CaseCreatedNotice;
        return caseCreatedNotice.data.status === 'STARTED'
          ? '#'
          : `/cases/${notice.data.accountId}`;
      case 'INGESTION':
        const ingestionNotice = notice as DocumentIngestionNotice;
        const pathSegments = ingestionNotice.data.filepath.split('/');
        // Remove the first segment (assumed to be a folder name)
        pathSegments.shift();
        pathSegments.shift();
        const filename = pathSegments.pop();
        const relativePath = pathSegments.join('/');
        return `/cases/${notice.data.accountId}/documents/${relativePath}?file=${filename}`;
      case 'ALERT':
        return `/cases/${notice.data.accountId}/feedback/${notice.data.clientFeedbackRequestId}`;
      default:
        return '#';
    }
  }

  function description(notice: Notice) {
    switch (notice.notificationType) {
      case 'DECLARATION':
        const declarationNotice = notice as DeclarationNotice;
        return declarationNotice.data.requestText
          ? declarationNotice.data.requestText
          : 'No Description';
      case 'ARGUMENT_BUILDER':
        const argumentBuilderNotice = notice as ArgumentBuilderNotice;
        return argumentBuilderNotice.data.requestText
          ? argumentBuilderNotice.data.requestText
          : 'No Description';
      case 'INGESTION':
        const ingestionNotice = notice as DocumentIngestionNotice;
        switch (ingestionNotice.data.status) {
          case 'PRELIMINARY':
            return `Preliminary ingestion completed for document ${ingestionNotice.data.filepath}.`;
          case 'EVIDENCE_EXTRACTION':
            return `Evidence extraction completed for document ${ingestionNotice.data.filepath}.`;
          case 'STARTED':
            return `Ingestion started for document ${ingestionNotice.data.filepath}.`;
          case 'SUCCESS':
            return `Document ${ingestionNotice.data.filepath} ingestion completed.`;
          case 'FAILED':
            return ingestionNotice.data.errorMessage
              ? `Ingestion failed for document ${ingestionNotice.data.filepath}: ${ingestionNotice.data.errorMessage}`
              : `Ingestion failed for document ${ingestionNotice.data.filepath}.`;
        }
      case 'EGESTION':
        const egestionNotice = notice as DocumentEgestionNotice;
        return `Document ${egestionNotice.data.filepath} removal completed.`;
      case 'CASE_CREATED':
        const caseCreatedNotice = notice as CaseCreatedNotice;
        if (caseCreatedNotice.data.status === 'SUCCESS') {
          return `Case ${caseCreatedNotice.data.accountId} created.`;
        }
        if (caseCreatedNotice.data.status === 'STARTED') {
          return `Case ${caseCreatedNotice.data.accountId} creation started.`;
        }
        return `Case ${caseCreatedNotice.data.accountId} creation failed.`;
      case 'CASE_DELETED':
        const caseDeletedNotice = notice as CaseDeletedNotice;
        if (caseDeletedNotice.data.status === 'SUCCESS') {
          return `Case ${caseDeletedNotice.data.accountId} deleted.`;
        }
        if (caseDeletedNotice.data.status === 'STARTED') {
          return `Case ${caseDeletedNotice.data.accountId} deletion started.`;
        }
        return `Case ${caseDeletedNotice.data.accountId} deletion failed.`;
      case 'ALERT':
        return 'Speaker-name feedback is requested for a media transcript.';
      default:
        return 'No Description';
    }
  }

  const filterControls = (
    <div className="mt-2 flex w-full flex-col gap-4 md:flex-row md:items-end">
      <div>
        <Listbox
          value={notificationTypeFilter ?? 'All Types'}
          onChange={(value) => {
            setNotificationTypeFilter(
              value === 'All Types' ? undefined : (value as NotificationType),
            );
          }}>
          <Label className="block text-sm/6 font-medium text-gray-900 dark:text-white font-semibold">
            Notification Types
          </Label>
          <div className="relative mt-2">
            <ListboxButton className="grid w-full cursor-default grid-cols-1 rounded-md bg-white py-1.5 pr-2 pl-3 text-left text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:focus-visible:outline-indigo-500">
              <span className="col-start-1 row-start-1 truncate pr-6">
                {formatNotificationType(notificationTypeFilter ?? 'All Types')}
              </span>
              <ChevronUpDownIcon
                aria-hidden="true"
                className="col-start-1 row-start-1 size-5 self-center justify-self-end text-gray-500 sm:size-4 dark:text-gray-400"
              />
            </ListboxButton>
            <ListboxOptions
              transition
              className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg outline-1 outline-black/5 data-leave:transition data-leave:duration-100 data-leave:ease-in data-closed:data-leave:opacity-0 sm:text-sm dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10">
              <ListboxOption
                key="ALL"
                value="All Types"
                className="block truncate font-normal group-data-selected:font-semibold hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 px-2 py-1 hover:cursor-pointer">
                All Types
              </ListboxOption>
              {NotificationTypeSchema.options.map((type) => (
                <ListboxOption key={type} value={type}>
                  <span className="block truncate font-normal group-data-selected:font-semibold hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 px-2 py-1 hover:cursor-pointer">
                    {formatNotificationType(type)}
                  </span>
                </ListboxOption>
              ))}
            </ListboxOptions>
          </div>
        </Listbox>
      </div>
      <div className="place-content-center md:grow">
        <label
          htmlFor="notifications-search"
          className="block text-sm/6 font-medium text-gray-900 dark:text-white font-semibold mb-1">
          Search
        </label>
        <input
          id="notifications-search"
          name="notifications-search"
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search"
          className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"></input>
      </div>
      <div className="place-content-center">
        <span className="block text-sm/6 font-medium text-gray-900 dark:text-white font-semibold mb-1">
          Unread Only
        </span>
        <div className="group relative inline-flex w-11 shrink-0 rounded-full bg-gray-200 p-0.5 inset-ring inset-ring-gray-900/5 outline-offset-2 outline-indigo-600 transition-colors duration-200 ease-in-out has-checked:bg-indigo-600 has-focus-visible:outline-2 dark:bg-white/5 dark:inset-ring-white/10 dark:outline-indigo-500 dark:has-checked:bg-indigo-500">
          <span className="relative size-5 rounded-full bg-white shadow-xs ring-1 ring-gray-900/5 transition-transform duration-200 ease-in-out group-has-checked:translate-x-5">
            <span
              aria-hidden="true"
              className="absolute inset-0 flex size-full items-center justify-center opacity-100 transition-opacity duration-200 ease-in group-has-checked:opacity-0 group-has-checked:duration-100 group-has-checked:ease-out">
              <svg
                fill="none"
                viewBox="0 0 12 12"
                className="size-3 text-gray-400 dark:text-gray-600">
                <path
                  d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span
              aria-hidden="true"
              className="absolute inset-0 flex size-full items-center justify-center opacity-0 transition-opacity duration-100 ease-out group-has-checked:opacity-100 group-has-checked:duration-200 group-has-checked:ease-in">
              <svg
                fill="currentColor"
                viewBox="0 0 12 12"
                className="size-3 text-indigo-600 dark:text-indigo-500">
                <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
              </svg>
            </span>
          </span>
          <input
            name="setting"
            type="checkbox"
            aria-label="Filter to show unread notifications only"
            className="absolute inset-0 size-full appearance-none focus:outline-hidden"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
          />
        </div>
      </div>
      <div className="place-content-center">
        <span className="block text-sm/6 font-medium text-gray-900 dark:text-white font-semibold mb-1">
          Include Deleted
        </span>
        <div className="group relative inline-flex w-11 shrink-0 rounded-full bg-gray-200 p-0.5 inset-ring inset-ring-gray-900/5 outline-offset-2 outline-indigo-600 transition-colors duration-200 ease-in-out has-checked:bg-indigo-600 has-focus-visible:outline-2 dark:bg-white/5 dark:inset-ring-white/10 dark:outline-indigo-500 dark:has-checked:bg-indigo-500">
          <span className="relative size-5 rounded-full bg-white shadow-xs ring-1 ring-gray-900/5 transition-transform duration-200 ease-in-out group-has-checked:translate-x-5">
            <span
              aria-hidden="true"
              className="absolute inset-0 flex size-full items-center justify-center opacity-100 transition-opacity duration-200 ease-in group-has-checked:opacity-0 group-has-checked:duration-100 group-has-checked:ease-out">
              <svg
                fill="none"
                viewBox="0 0 12 12"
                className="size-3 text-gray-400 dark:text-gray-600">
                <path
                  d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span
              aria-hidden="true"
              className="absolute inset-0 flex size-full items-center justify-center opacity-0 transition-opacity duration-100 ease-out group-has-checked:opacity-100 group-has-checked:duration-200 group-has-checked:ease-in">
              <svg
                fill="currentColor"
                viewBox="0 0 12 12"
                className="size-3 text-indigo-600 dark:text-indigo-500">
                <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
              </svg>
            </span>
          </span>
          <input
            name="include-deleted"
            type="checkbox"
            aria-label="Include deleted notifications"
            className="absolute inset-0 size-full appearance-none focus:outline-hidden"
            checked={includeDeleted}
            onChange={(e) => setIncludeDeleted(e.target.checked)}
          />
        </div>
      </div>
      <div className="place-content-center">
        <span className="block text-sm/6 font-medium text-gray-900 dark:text-white font-semibold mb-1">
          Delete
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Delete all notifications"
          onClick={() => setDeleteAllDialogOpen(true)}
          disabled={isDeletingAll || notices.length === 0}>
          <Trash2Icon className="h-4 w-4" />
          {isDeletingAll ? 'Deleting...' : 'Delete All'}
        </button>
      </div>
    </div>
  );

  const filterSection = (
    <ResponsiveAccordion
      items={[
        {
          id: 'notification-controls',
          title: 'Filters & Actions',
          content: filterControls,
        },
      ]}
    />
  );

  useEffect(() => {
    if (
      (!searchTerm || searchTerm.trim() === '') &&
      notificationTypeFilter === undefined &&
      !unreadOnly
    ) {
      setFilteredNotices(notices);
    } else {
      const lowerSearchTerm = searchTerm?.toLowerCase();
      const filtered = notices
        .filter((notice) => {
          if (unreadOnly) {
            return !notice.read;
          }
          return true;
        })
        .filter((notice) => {
          const desc = description(notice).toLowerCase();

          return !lowerSearchTerm || desc.includes(lowerSearchTerm);
        })
        .filter((notice) => {
          if (notificationTypeFilter) {
            return notice.notificationType === notificationTypeFilter;
          }
          return true;
        });
      setFilteredNotices(filtered);
    }
  }, [searchTerm, notificationTypeFilter, notices, unreadOnly]);

  const deleteNotification = async (notice: Notice) => {
    try {
      const response = await fetchWithAuth(
        `/api/accounts/notifications/${notice.id}?notificationType=${notice.notificationType}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        SCOPES,
      );
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.error('Failed to delete notification:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
        });
        return;
      }
      logger.info('Notification deleted, refreshing notices...');
      await refreshNotices();
      emitNotification('notify:deleted', {
        id: notice.id,
        notificationType: notice.notificationType,
      });
    } catch (error) {
      logger.error('Error deleting notification:', error);
    }
  };

  const deleteAllNotifications = async () => {
    if (!notices.length) {
      return;
    }
    try {
      setIsDeletingAll(true);
      const response = await fetchWithAuth(
        '/api/accounts/notifications',
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        SCOPES,
      );
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(
          'Failed to delete all notifications:',
          response.status,
          response.statusText,
          errorText,
        );
        return;
      }
      console.log('All notifications deleted, refreshing notices...');
      await refreshNotices();
      emitNotification('notify:deleted', {
        id: 'all',
        notificationType: 'ALL',
      });
    } catch (error) {
      console.error('Error deleting all notifications:', error);
    } finally {
      setIsDeletingAll(false);
    }
  };

  return (
    <PageTemplate
      title="Notifications"
      isLoading={loading}
      actionSection={filterSection}>
      <div>
        {fetchError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-200">
            {fetchError}
          </div>
        )}
        <StackedList isLoading={loading} isEmpty={filteredNotices.length === 0} emptyMessage="No notifications found.">
          {filteredNotices.map((entry) => {
            const href = iconHref(entry);
            return (
              <StackedListItem
                key={entry.id}
                title={formatNotificationType(entry.notificationType)}
                badge={
                  <span className="inline-flex items-center gap-2">
                    {notificationStatusBadge(entry)}
                    <StatusBadge tone={entry.read ? 'gray' : 'blue'}>
                      {entry.read ? 'Read' : 'Unread'}
                    </StatusBadge>
                  </span>
                }
                description={description(entry)}
                metadata={[
                  `Received ${entry.createdAt ? entry.createdAt.toLocaleString() : 'Unknown'}`,
                  entry.readAt ? `Read ${entry.readAt.toLocaleString()}` : 'Not yet read',
                ]}
                primaryAction={href !== '#' ? <PrimaryListLink href={href} onClick={() => void readHandler(entry)}>View</PrimaryListLink> : undefined}
                menuLabel={`Options for ${formatNotificationType(entry.notificationType)} notification`}
                menuActions={[
                  ...(!entry.read ? [{ label: 'Mark as read', onClick: () => void readHandler(entry) }] : []),
                  { label: 'Delete', onClick: () => void deleteNotification(entry) },
                ]}
              />
            );
          })}
        </StackedList>
        <ConfirmationDialog
          title="Delete all notifications?"
          description="This will remove all notifications from your list. This cannot be undone."
          confirmButtonText="Delete all"
          cancelButtonText="Cancel"
          defaultOpen={deleteAllDialogOpen}
          onClose={(confirmed) => {
            setDeleteAllDialogOpen(false);
            if (confirmed) {
              deleteAllNotifications();
            }
          }}
        />
      </div>
    </PageTemplate>
  );

  function formatNotificationType(type: string) {
    return type.charAt(0) + type.slice(1).toLowerCase().replaceAll('_', ' ');
  }

  function terminalStatusBadge(status: string) {
    switch (status) {
      case 'SUCCESS':
        return <StatusBadge tone="green">Success</StatusBadge>;
      case 'FAILED':
        return <StatusBadge tone="red">Failed</StatusBadge>;
      default:
        return null;
    }
  }

  function notificationStatusBadge(notice: Notice) {
    switch (notice.notificationType) {
      case 'INGESTION':
        switch (notice.data.status) {
          case 'PRELIMINARY':
            return <StatusBadge tone="orange">Preliminary</StatusBadge>;
          case 'EVIDENCE_EXTRACTION':
            return <StatusBadge tone="orange">Evidence Extraction</StatusBadge>;
          default:
            return terminalStatusBadge(notice.data.status);
        }
      case 'DECLARATION':
      case 'ARGUMENT_BUILDER':
      case 'TIMELINE_BUILDER':
      case 'EGESTION':
      case 'CASE_CREATED':
      case 'CASE_DELETED':
        return terminalStatusBadge(notice.data.status);
      default:
        return null;
    }
  }
}
