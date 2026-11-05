'use client';
import { logger } from '@/lib/logger';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { CaseForm } from '@/components/cases/CaseForm';
import CasePageTemplate from '@/components/cases/CasePageTemplate';
import { useAccountAccess } from '@/hooks/useAccountAccess';
import { useAuth } from '@/hooks/useAuth';
import {
  getCachedCaseAccount,
  invalidateCachedCaseAccount,
} from '@/lib/caseAccountRequestCache';
import { clearAccountCasesCache } from '@/hooks/useAccountCases';
import { CaseMap, UserAccountSchema } from '@/lib/types';
import { PencilLineIcon, Trash2Icon, UserMinusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CaseProfile } from './_components/CaseProfile';

export default function CasePage({
  params,
}: Readonly<{
  params: Promise<{ case: string }>;
}>) {
  const { account, fetchWithAuth } = useAuth();
  const { access } = useAccountAccess();
  const router = useRouter();
  const [data, setData] = useState<CaseMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [caseFormActions, setCaseFormActions] = useState<HTMLDivElement | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const accountCacheScope =
    account?.homeAccountId || account?.localAccountId || account?.username;

  useEffect(() => {
    (async () => {
      const { case: caseId } = await params;
      logger.info('Case ID from params:', caseId);
      setCaseId(caseId);
    })();
  }, [params]);

  useEffect(() => {
    if (!caseId) {
      return;
    }

    let canceled = false;
    setLoading(true);
    setError(null);
    setData(null);

    (async () => {
      try {
        const account = await getCachedCaseAccount({
          caseId,
          cacheScope: accountCacheScope,
          fetchWithAuth,
        });
        if (!canceled) {
          setData(account.casesAccounts[0] || null);
        }
      } catch (e: unknown) {
        const error = e as Error;
        if (!canceled) {
          setError(error.message ?? 'Request failed');
        }
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [accountCacheScope, fetchWithAuth, caseId]);

  const isGuestCase = data?.isGuest === true;
  const isCaseActive = data ? data.isActive !== false : false;
  const canEdit =
    access?.agreedToTerms === true &&
    data?.agreedToCaseTerms === true &&
    !isGuestCase;
  const showEditForm = isEditing && canEdit;
  const removeActionLabel = isGuestCase ? 'Unshare Case' : 'Delete';

  function closeEditor() {
    setIsEditing(false);
    setSaveError(null);
    document.querySelector('[data-slot="page-content"]')?.scrollTo(0, 0);
  }

  async function submitCaseChanges(caseData: CaseMap) {
    if (!caseId || !canEdit || saving) {
      return false;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetchWithAuth(`/api/accounts/cases/${caseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(caseData),
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const updatedAccount = UserAccountSchema.parse(await response.json());
      const updated = updatedAccount.casesAccounts[0];
      if (!updated) {
        throw new Error('The updated case was missing from the response.');
      }

      setData(updated);
      invalidateCachedCaseAccount(caseId, accountCacheScope);
      clearAccountCasesCache();
      globalThis.dispatchEvent(
        new CustomEvent('case:updated', {
          detail: { caseId, caseAccess: updated, caseAccount: updatedAccount },
        }),
      );
      globalThis.dispatchEvent(new Event('account:cases-changed'));
      setSaveNotice('Case changes saved.');
      closeEditor();
      return true;
    } catch (error) {
      setSaveError(
        `Failed to update case: ${(error as Error).message || 'Request failed'}`,
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveCase() {
    if (!caseId || !data || !isCaseActive) {
      return;
    }

    setRemoving(true);
    setRemoveError(null);
    try {
      const res = await fetchWithAuth(
        isGuestCase
          ? `/api/accounts/cases/${caseId}/users/me`
          : `/api/accounts/cases/${caseId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const details = await res.text();
        throw new Error(details || `${res.status} ${res.statusText}`);
      }

      clearAccountCasesCache();
      invalidateCachedCaseAccount(caseId, accountCacheScope);
      setData(null);
      router.replace('/cases');
    } catch (e: unknown) {
      const error = e as Error;
      setRemoveError(
        error.message ||
        (isGuestCase ? 'Failed to unshare case' : 'Failed to delete case'),
      );
    } finally {
      setRemoving(false);
    }
  }

  return (
    <CasePageTemplate
      title="Case Details"
      isLoading={loading}
      params={params}
      actionSection={
        data && (
          <div className="mb-4 flex flex-wrap items-center gap-2 md:justify-end">
            {showEditForm && <div ref={setCaseFormActions} />}
            {canEdit && !showEditForm && (
              <button
                type="button"
                onClick={() => {
                  setSaveNotice(null);
                  setIsEditing(true);
                }}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500">
                <PencilLineIcon aria-hidden="true" className="h-4 w-4" />
                Edit Case
              </button>
            )}
            {isCaseActive && (
              <button
                type="button"
                onClick={() => setRemoveDialogOpen(true)}
                disabled={removing}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60">
                {isGuestCase ? (
                  <UserMinusIcon aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <Trash2Icon aria-hidden="true" className="h-4 w-4" />
                )}
                {removing
                  ? isGuestCase
                    ? 'Unsharing...'
                    : 'Deleting...'
                  : removeActionLabel}
              </button>
            )}
          </div>
        )
      }>
      {error && <div className="text-red-500">Error: {error}</div>}
      {removeError && (
        <div role="alert" className="text-sm text-red-600">
          {removeError}
        </div>
      )}
      {saveNotice && (
        <div role="status" className="mb-4 text-sm text-green-700 dark:text-green-400">
          {saveNotice}
        </div>
      )}
      {saveError && (
        <div role="alert" className="mb-4 text-sm text-red-600">
          {saveError}
        </div>
      )}
      {!loading && !error && !data && <div>No cases found.</div>}
      {!loading && !error && data && (
        <div className="max-w-7xl">
          {showEditForm ? (
            <CaseForm
              defaultValue={data}
              onSubmit={submitCaseChanges}
              onCancel={closeEditor}
              isEditable={true}
              isSubmitting={saving}
              actionsContainer={caseFormActions}
            />
          ) : (
            <CaseProfile data={data} />
          )}
        </div>
      )}
      <ConfirmationDialog
        title={removeActionLabel}
        description={
          isGuestCase
            ? 'This will remove your access to this shared case.'
            : 'This will delete this case. This action cannot be undone.'
        }
        confirmButtonText={isGuestCase ? 'Unshare' : 'Delete'}
        cancelButtonText="Cancel"
        defaultOpen={removeDialogOpen}
        onClose={(confirmed) => {
          setRemoveDialogOpen(false);
          if (confirmed) {
            void handleRemoveCase();
          }
        }}
      />
    </CasePageTemplate>
  );
}
