'use client';

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import TermsOfServiceModal from '@/components/TermsOfServiceModal';
import { useAuth } from '@/hooks/useAuth';
import { OctagonAlertIcon } from 'lucide-react';
import {
  CaseAccountRequestError,
  getCachedCaseAccount,
  invalidateCachedCaseAccount,
} from '@/lib/caseAccountRequestCache';
import {
  getTermsTypeForBillingCode,
  type TermsOfServiceType,
} from '@/lib/termsOfService';
import { useEffect, useState, type ReactNode } from 'react';

type CaseTermsGateProps = Readonly<{
  caseId: string;
  children: ReactNode;
}>;

export default function CaseTermsGate({
  caseId,
  children,
}: CaseTermsGateProps) {
  const { account, fetchWithAuth, isAuthenticated } = useAuth();
  const [isResolved, setIsResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAcceptedCaseTerms, setHasAcceptedCaseTerms] = useState(false);
  const [termsType, setTermsType] = useState<TermsOfServiceType>('general');
  const [showInactiveAccountModal, setShowInactiveAccountModal] =
    useState(false);
  const accountCacheScope =
    account?.homeAccountId || account?.localAccountId || account?.username;

  useEffect(() => {
    setIsResolved(false);
    setError(null);
    setHasAcceptedCaseTerms(false);
    setTermsType('general');
    setShowInactiveAccountModal(false);

    if (!isAuthenticated) {
      setIsResolved(true);
      return;
    }

    let canceled = false;

    (async () => {
      try {
        const caseData = await getCachedCaseAccount({
          caseId,
          cacheScope: accountCacheScope,
          fetchWithAuth,
        });
        const caseAccess = caseData.casesAccounts?.[0];
        if (canceled) {
          return;
        }

        setHasAcceptedCaseTerms(caseAccess?.agreedToCaseTerms === true);
        setTermsType(
          getTermsTypeForBillingCode(
            caseAccess?.termsBillingCode ?? caseAccess?.billingCode,
          ),
        );
      } catch (error) {
        if (!canceled) {
          if (
            error instanceof CaseAccountRequestError &&
            error.status === 403 &&
            error.code === 'ACCOUNT_INACTIVE'
          ) {
            setShowInactiveAccountModal(true);
          } else {
            setError(
              'Unable to verify case terms access right now. Please refresh the page or try again later.',
            );
          }
        }
      } finally {
        if (!canceled) {
          setIsResolved(true);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [accountCacheScope, caseId, fetchWithAuth, isAuthenticated]);

  if (showInactiveAccountModal) {
    return (
      <Dialog
        open={true}
        onClose={() => window.location.assign('/cases')}
        className="relative z-999">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in dark:bg-gray-900/50"
        />
        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel
              transition
              className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-lg sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95 dark:bg-gray-800 dark:outline dark:-outline-offset-1 dark:outline-white/10">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex size-12 shrink-0 items-center justify-center rounded-full bg-red-50 sm:mx-0 dark:bg-red-500/10">
                  <OctagonAlertIcon
                    aria-hidden="true"
                    className="size-6 text-red-600 dark:text-red-400"
                  />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <DialogTitle
                    as="h3"
                    className="text-base font-semibold text-gray-900 dark:text-white">
                    Account inactive
                  </DialogTitle>
                  <div className="mt-2 space-y-2 text-sm text-gray-500 dark:text-gray-400">
                    <p>
                      Your account is not active and does not have access to
                      Case pages.
                    </p>
                    <p>
                      To enable your account, contact your service administrator.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => window.location.assign('/cases')}
                  className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:w-auto dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500">
                  Back to Cases
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    );
  }

  if (!isResolved || error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {error || 'Checking your case terms access...'}
        </p>
      </main>
    );
  }

  if (!hasAcceptedCaseTerms) {
    return (
      <TermsOfServiceModal
        opened={true}
        scope="case"
        termsType={termsType}
        caseId={caseId}
        onAccepted={() => {
          invalidateCachedCaseAccount(caseId, accountCacheScope);
          setHasAcceptedCaseTerms(true);
          globalThis.dispatchEvent(
            new CustomEvent('terms:accepted', {
              detail: { scope: 'case', caseId },
            }),
          );
        }}
        onDeclined={() => {
          window.location.assign('/cases');
        }}
      />
    );
  }

  return <>{children}</>;
}
