'use client';

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@/hooks/useAuth';
import type {
  TermsOfServiceDocument,
  TermsOfServiceScope,
  TermsOfServiceType,
} from '@/lib/termsOfService';

type TermsOfServiceModalProps = {
  readonly opened: boolean;
  readonly scope: TermsOfServiceScope;
  readonly termsType: TermsOfServiceType;
  readonly caseId?: string;
  readonly onAccepted: () => void;
  readonly onDeclined?: () => void;
  readonly onCanceled?: () => void;
  readonly allowCancel?: boolean;
  readonly declineText?: string;
};

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-base font-semibold text-gray-950 dark:text-white">
      {children}
    </h2>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-sm font-semibold text-gray-950 dark:text-white">
      {children}
    </h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc space-y-1 pl-5">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal space-y-1 pl-5">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-gray-950 dark:text-white">
      {children}
    </strong>
  ),
};

export default function TermsOfServiceModal({
  opened,
  scope,
  termsType,
  caseId,
  onAccepted,
  onDeclined,
  onCanceled,
  allowCancel = false,
  declineText = 'Decline',
}: TermsOfServiceModalProps) {
  const { fetchWithAuth } = useAuth();
  const [document, setDocument] = useState<TermsOfServiceDocument | null>(null);
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userType, setUserType] = useState<'attorney' | 'end-client'>('attorney');

  useEffect(() => {
    if (!opened) {
      return;
    }

    let canceled = false;
    setDocument(null);
    setHasConfirmed(false);
    setIsLoadingDocument(true);
    setError(null);

    (async () => {
      try {
        const searchParams = new URLSearchParams({ scope, termsType });
        if (scope === 'user-account') {
          searchParams.set('userType', userType);
        }
        const response = await fetchWithAuth(
          '/api/accounts/terms?' + searchParams.toString(),
          {
            method: 'GET',
            cache: 'no-store',
          },
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(payload?.error || 'Unable to load terms agreement.');
        }

        const payload = (await response.json()) as TermsOfServiceDocument;
        if (!canceled) {
          setDocument(payload);
        }
      } catch (requestError) {
        if (!canceled) {
          setError((requestError as Error).message);
        }
      } finally {
        if (!canceled) {
          setIsLoadingDocument(false);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [fetchWithAuth, opened, scope, termsType, userType]);

  async function acceptTerms() {
    if (!hasConfirmed || isSubmitting || !document) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetchWithAuth('/api/accounts/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, termsType, caseId, ...(scope === 'user-account' ? { userType, affirmativeAcceptance: true } : {}) }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || 'Unable to save terms acceptance.');
      }

      onAccepted();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = document?.title || 'Terms of Service';
  const effectiveDate = document?.effectiveDate;
  const isUserClickwrap = scope === 'user-account';
  const assentText = userType === 'attorney'
    ? 'By clicking I Accept, you agree to the Pro Bono Law Terms of Service, and you acknowledge the Privacy Policy. The Terms of Service incorporate the Business Associate Agreement, the Data Processing Addendum, and the Acceptable Use Policy. You confirm you are at least 18 years of age and, if you are accepting for an organization, that you are authorized to bind that organization.'
    : 'By clicking I Accept, you agree to the Pro Bono Law End-Client Terms. You confirm that you are at least 18 years of age.';

  return (
    <Dialog
      open={opened}
      onClose={() => {
        if (allowCancel) {
          onCanceled?.();
        }
      }}
      className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-gray-500/75 dark:bg-gray-900/60" />
      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-left">
          <DialogPanel className="w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-800 dark:outline dark:-outline-offset-1 dark:outline-white/10">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-white/10">
              <DialogTitle className="text-lg font-semibold text-gray-950 dark:text-white">
                {title}
              </DialogTitle>
              {effectiveDate && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Effective {effectiveDate}
                </p>
              )}
            </div>

            <div className="max-h-[55vh] space-y-4 overflow-y-auto px-6 py-5 text-sm leading-6 text-gray-700 dark:text-gray-200">
              {isLoadingDocument && <p>Loading terms agreement...</p>}
              {isUserClickwrap && (
                <fieldset className="space-y-3 rounded-md border border-gray-200 p-3 dark:border-white/10">
                  <legend className="px-1 font-medium">
                    I am creating an account as
                  </legend>
                  <label className="mr-5">
                    <input
                      type="radio"
                      name="user-type"
                      checked={userType === 'attorney'}
                      onChange={() => setUserType('attorney')}
                    />{' '}
                    <span className="ml-2">
                      an attorney or authorized organization representative
                    </span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="user-type"
                      checked={userType === 'end-client'}
                      onChange={() => setUserType('end-client')}
                    />{' '}
                    <span className="ml-2">a non-attorney end client</span>
                  </label>
                </fieldset>
              )}
              {document && isUserClickwrap && (
                <p className="rounded-md bg-indigo-50 p-3 text-indigo-950 dark:bg-indigo-950/40 dark:text-indigo-100">
                  Review the applicable agreement
                  {userType === 'attorney' ? 's' : ''}:{' '}
                  {userType === 'attorney' ? (
                    <>
                      <Link className="underline" href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</Link>,{' '}
                      <Link className="underline" href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>,{' '}
                      <Link className="underline" href="/baa" target="_blank" rel="noopener noreferrer">BAA</Link>,{' '}
                      <Link className="underline" href="/dpa" target="_blank" rel="noopener noreferrer">DPA</Link>, and{' '}
                      <Link className="underline" href="/aup" target="_blank" rel="noopener noreferrer">AUP</Link>.
                    </>
                  ) : (
                    <Link className="underline" href="/end-client-terms" target="_blank" rel="noopener noreferrer">End-Client Terms</Link>
                  )}
                </p>
              )}
              {document && (
                <ReactMarkdown components={markdownComponents}>
                  {document.markdown}
                </ReactMarkdown>
              )}
              {document && (
                <label className="flex gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
                  <input
                    type="checkbox"
                    checked={hasConfirmed}
                    onChange={(event) => setHasConfirmed(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                  />
                  <span>{isUserClickwrap ? assentText : document.acknowledgement}</span>
                </label>
              )}
              {error && (
                <p className="rounded-md bg-red-50 p-3 text-red-700 dark:bg-red-950/40 dark:text-red-200">
                  {error}
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 bg-gray-50 px-6 py-4 sm:flex-row sm:justify-end dark:bg-gray-900/40">
              {allowCancel && (
                <button
                  type="button"
                  onClick={onCanceled}
                  disabled={isSubmitting}
                  className="inline-flex justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring-1 inset-ring-gray-300 hover:bg-gray-50 disabled:opacity-50 dark:bg-white/10 dark:text-white dark:inset-ring-white/10 dark:hover:bg-white/20">
                  Cancel
                </button>
              )}
              {onDeclined && (
                <button
                  type="button"
                  onClick={onDeclined}
                  disabled={isSubmitting}
                  className="inline-flex justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring-1 inset-ring-gray-300 hover:bg-gray-50 disabled:opacity-50 dark:bg-white/10 dark:text-white dark:inset-ring-white/10 dark:hover:bg-white/20">
                  {declineText}
                </button>
              )}
              <button
                type="button"
                onClick={acceptTerms}
                disabled={!hasConfirmed || isSubmitting || !document}
                className="inline-flex justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400">
                {isSubmitting ? 'Saving...' : isUserClickwrap ? 'I Accept' : 'Agree'}
              </button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
