'use client';
import AuthGuard from '@/components/AuthGuard';
import { useEffect, useRef, useState } from 'react';

import CaseDetails from '@/components/CaseDetails';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import PageTemplate from '@/components/PageTemplate';
import { StackedList, StackedListItem, StatusBadge } from '@/components/lists/StackedList';
import { printTitle } from '@/lib/caseUtils';
import { useCases } from '@/hooks/useCases';
import { useAccountAccess } from '@/hooks/useAccountAccess';
import { useEventHandler } from '@/lib/notificationEvents';
import type { UserAccountModel } from '../../lib/types';

type CaseLifecycleStatus = 'STARTED' | 'SUCCESS' | 'FAILED';
type PendingCaseRow = {
  accountId: string;
  status: CaseLifecycleStatus;
  fadingOut: boolean;
};

const PENDING_ROW_FADE_MS = 900;

function normalizeLifecycleStatus(
  status?: string,
): CaseLifecycleStatus | undefined {
  if (!status) return undefined;
  const normalized = status.toUpperCase();
  if (normalized === 'STARTED') return 'STARTED';
  if (normalized === 'SUCCESS' || normalized === 'SUCCESSFUL')
    return 'SUCCESS';
  if (normalized === 'FAILED') return 'FAILED';
  return undefined;
}

function PendingCaseDetails({ pendingCase }: Readonly<{ pendingCase: PendingCaseRow }>) {
  const isFailed = pendingCase.status === 'FAILED';
  return (
    <StackedListItem
      className={`transition-opacity duration-700 ${pendingCase.fadingOut ? 'opacity-0' : 'opacity-100'}`}
      title={`Case ${pendingCase.accountId}`}
      badge={<StatusBadge tone={isFailed ? 'red' : 'yellow'}>{isFailed ? 'Failed' : 'Creating'}</StatusBadge>}
      description={isFailed ? 'Case creation failed. This entry will disappear shortly.' : 'Case creation started. Case details are not available yet.'}
      metadata={['Actions available when creation completes']}
    />
  );
}

function DeletingCaseDetails({ caseItem }: Readonly<{ caseItem: UserAccountModel['casesAccounts'][0] }>) {
  const record = caseItem.record;
  return (
    <StackedListItem
      title={record ? printTitle(record) : 'Case unavailable'}
      badge={<StatusBadge tone="yellow">Deleting</StatusBadge>}
      description={record?.description || 'Case deletion started. Actions are disabled.'}
      metadata={record ? [
        `Case number: ${record.caseNumber || 'N/A'}`,
        `Location: ${record.county || 'N/A'}, ${record.state || 'N/A'}`,
        'Actions disabled while deleting',
      ] : ['Waiting for deletion completion']}
    />
  );
}

export default function CasesPage() {
  const { data, error, loading, refresh } = useCases();
  const { access } = useAccountAccess();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [pendingCases, setPendingCases] = useState<
    Record<string, PendingCaseRow>
  >({});
  const [deletingCases, setDeletingCases] = useState<Record<string, true>>({});
  const [failureDialog, setFailureDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
  }>({
    open: false,
    title: '',
    description: '',
  });
  const pendingCaseTimersRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});

  function clearPendingCaseTimer(accountId: string) {
    const timer = pendingCaseTimersRef.current[accountId];
    if (timer) {
      clearTimeout(timer);
      delete pendingCaseTimersRef.current[accountId];
    }
  }

  function removePendingCase(accountId: string) {
    clearPendingCaseTimer(accountId);
    setPendingCases((current) => {
      if (!current[accountId]) {
        return current;
      }
      const next = { ...current };
      delete next[accountId];
      return next;
    });
  }

  function setCaseDeleting(accountId: string) {
    setDeletingCases((current) => ({
      ...current,
      [accountId]: true,
    }));
  }

  function clearCaseDeleting(accountId: string) {
    setDeletingCases((current) => {
      if (!current[accountId]) {
        return current;
      }
      const next = { ...current };
      delete next[accountId];
      return next;
    });
  }

  function showFailureDialog(title: string, description: string) {
    setFailureDialog({
      open: true,
      title,
      description,
    });
  }

  function startPendingCaseFadeOut(accountId: string) {
    setPendingCases((current) => ({
      ...current,
      [accountId]: {
        accountId,
        status: 'FAILED',
        fadingOut: false,
      },
    }));
    requestAnimationFrame(() => {
      setPendingCases((current) => {
        const entry = current[accountId];
        if (!entry || entry.status !== 'FAILED') {
          return current;
        }
        return {
          ...current,
          [accountId]: { ...entry, fadingOut: true },
        };
      });
    });
    clearPendingCaseTimer(accountId);
    pendingCaseTimersRef.current[accountId] = setTimeout(() => {
      removePendingCase(accountId);
    }, PENDING_ROW_FADE_MS);
  }

  useEffect(() => {
    return () => {
      Object.values(pendingCaseTimersRef.current).forEach((timer) =>
        clearTimeout(timer),
      );
      pendingCaseTimersRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (data.length === 0 || Object.keys(pendingCases).length === 0) {
      return;
    }
    const caseIds = new Set(
      data
        .map((caseItem) => caseItem.accountId)
        .filter((accountId): accountId is string => Boolean(accountId)),
    );
    Object.keys(pendingCases).forEach((accountId) => {
      if (caseIds.has(accountId)) {
        removePendingCase(accountId);
      }
    });
  }, [data, pendingCases]);

  useEventHandler('notify:new', (event) => {
    if (!event.accountId) {
      return;
    }

    const status = normalizeLifecycleStatus(event.status);
    if (!status) {
      return;
    }

    const accountId = event.accountId;

    if (event.notificationType === 'CASE_CREATED') {
      if (status === 'STARTED') {
        const caseAlreadyLoaded = data.some(
          (caseItem) => caseItem.accountId === accountId,
        );
        if (caseAlreadyLoaded) {
          return;
        }
        clearPendingCaseTimer(accountId);
        setPendingCases((current) => ({
          ...current,
          [accountId]: {
            accountId,
            status: 'STARTED',
            fadingOut: false,
          },
        }));
        return;
      }

      if (status === 'SUCCESS') {
        removePendingCase(accountId);
        refresh();
        return;
      }

      startPendingCaseFadeOut(accountId);
      showFailureDialog(
        'Case Creation Failed',
        event.errorMessage ||
        `Case ${accountId} creation failed. Please review notifications for more details.`,
      );
      return;
    }

    if (event.notificationType === 'CASE_DELETED') {
      if (status === 'STARTED') {
        const caseAlreadyLoaded = data.some(
          (caseItem) => caseItem.accountId === accountId,
        );
        if (!caseAlreadyLoaded) {
          return;
        }
        removePendingCase(accountId);
        setCaseDeleting(accountId);
        return;
      }

      if (status === 'SUCCESS') {
        clearCaseDeleting(accountId);
        refresh();
        return;
      }

      clearCaseDeleting(accountId);
      showFailureDialog(
        'Case Deletion Failed',
        event.errorMessage ||
        `Case ${accountId} deletion failed. Please review notifications for more details.`,
      );
    }
  });
  type CaseAccount = UserAccountModel['casesAccounts'][number];
  const hasRecord = (
    caseAccount: CaseAccount,
  ): caseAccount is CaseAccount & {
    record: NonNullable<CaseAccount['record']>;
  } => caseAccount.record != null;

  function filterCases(
    casesAccounts: UserAccountModel['casesAccounts'],
    term: string,
  ) {
    const casesWithRecord = casesAccounts.filter(hasRecord);
    if (!term) return casesWithRecord;
    const lowerTerm = term.toLowerCase();
    return casesWithRecord.filter(
      (ca) =>
        (ca.record.accountId?.toLowerCase().includes(lowerTerm)) ||
        (ca.record.personInformation?.lastName.toLowerCase().includes(lowerTerm)) ||
        (ca.record.personInformation?.firstName.toLowerCase().includes(lowerTerm)) ||
        (ca.record.personInformation?.middleInitial?.toLowerCase().includes(lowerTerm)) ||
        (ca.record.personInformation?.emailAddress?.toLowerCase().includes(lowerTerm)) ||
        (ca.record.caseNumber?.toLowerCase().includes(lowerTerm)) ||
        (ca.record.description?.toLowerCase().includes(lowerTerm)) ||
        (ca.record.state?.toLowerCase().includes(lowerTerm)) ||
        (ca.record.county?.toLowerCase().includes(lowerTerm)) ||
        (ca.record.filingRole?.toLowerCase().includes(lowerTerm)) ||
        (ca.record.opposition?.firstName?.toLowerCase().includes(lowerTerm)) ||
        (ca.record.opposition?.lastName?.toLowerCase().includes(lowerTerm)) ||
        (ca.record.opposition?.filingRole?.toLowerCase().includes(lowerTerm)) ||
        (ca.record.opposition?.attorneyInformation?.some(
          (att) =>
            (att.firstName?.toLowerCase().includes(lowerTerm)) ||
            (att.lastName?.toLowerCase().includes(lowerTerm)) ||
            (att.emailAddress?.toLowerCase().includes(lowerTerm)) ||
            (att.phoneNumber?.toLowerCase().includes(lowerTerm)),
        )) ||
        (ca.record.currentAttorney?.firstName?.toLowerCase().includes(lowerTerm)) ||
        (ca.record.currentAttorney?.lastName?.toLowerCase().includes(lowerTerm)) ||
        (ca.record.currentAttorney?.emailAddress?.toLowerCase().includes(lowerTerm)) ||
        (ca.record.currentAttorney?.phoneNumber?.toLowerCase().includes(lowerTerm)),
    );
  }

  const pending = Object.values(pendingCases);
  const visiblePendingCases = !searchTerm
    ? pending
    : pending.filter((caseItem) =>
      caseItem.accountId.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  const filteredCases = filterCases(data, searchTerm);
  const hasVisibleRows =
    visiblePendingCases.length > 0 || filteredCases.length > 0;

  return (
    <AuthGuard>
      <PageTemplate
        title="Case Explorer"
        isLoading={loading}
        className="md:w-7xl"
        actionSection={
          <div className="flex flex-row-reverse  mb-4">
            <input
              type="text"
              placeholder="Search cases..."
              className="border border-gray-300 rounded-md p-2 mb-4 w-full max-w-md"
              onInput={(x) => setSearchTerm(x.currentTarget.value)}
            />
          </div>
        }>
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
        {!loading && !error && hasVisibleRows && (
          <div className="max-w-7xl">
            <StackedList>
              {visiblePendingCases.map((pendingCase) => (
                <PendingCaseDetails
                  key={`pending-${pendingCase.accountId}`}
                  pendingCase={pendingCase}
                />
              ))}
              {filteredCases.map((caseItem) =>
                caseItem.accountId && deletingCases[caseItem.accountId] ? (
                  <DeletingCaseDetails
                    key={caseItem.accountId}
                    caseItem={caseItem}
                  />
                ) : (
                  <CaseDetails key={caseItem.accountId} caseItem={caseItem} agreedToTerms={access?.agreedToTerms} />
                ),
              )}
            </StackedList>
          </div>
        )}
        {!loading && !error && !hasVisibleRows && <p>No cases found.</p>}
        <ConfirmationDialog
          title={failureDialog.title}
          description={failureDialog.description}
          confirmButtonText="OK"
          cancelButtonText="Close"
          defaultOpen={failureDialog.open}
          onClose={() =>
            setFailureDialog((current) => ({ ...current, open: false }))
          }
        />
      </PageTemplate>
    </AuthGuard>
  );
}
