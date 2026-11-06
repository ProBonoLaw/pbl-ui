import { useAccountCases } from '@/hooks/useAccountCases';
import { useAccountAccess } from '@/hooks/useAccountAccess';
import { useAuth } from '@/hooks/useAuth';
import { printTitle } from '@/lib/caseUtils';
import Link from 'next/link';
import { GavelIcon } from 'lucide-react';

export default function CasePanel({
  accessQueryEnabled = true,
}: {
  accessQueryEnabled?: boolean;
}) {
  const { isAttorney } = useAuth();
  const { cases, error, loading } = useAccountCases();
  const {
    access,
    loading: loadingAccess,
    error: accessError,
  } = useAccountAccess({
    enabled: accessQueryEnabled,
  });

  const canCreateCase =
    accessQueryEnabled &&
    !loadingAccess &&
    !accessError &&
    access?.agreedToTerms === true &&
    access?.isActive === true;
  const createCaseWarning = accessQueryEnabled
    ? loadingAccess
      ? 'Checking account access…'
      : accessError
        ? 'Create Case is unavailable because we could not verify your account access right now. Please refresh the page or try again later.'
        : access?.agreedToTerms === false
          ? "Create Case is unavailable until you've agreed to terms. Please review and accept the terms to enable this feature."
          : access?.isActive === false
            ? 'Create Case is unavailable because your account has become inactive. Please contact support for assistance.'
            : null
    : null;

  const data = cases.filter(
    (caseAccount) =>
      caseAccount.record != null &&
      caseAccount.record.isSharedResource !== true,
  );

  if (loading) {
    return <div>Loading cases...</div>;
  }
  if (error) {
    return <div className="text-red-600">Error: {error}</div>;
  }

  return (
    <div className="bg-white md:py-8 sm:py-16 dark:bg-gray-900 items-center justify-items-center pt-6 pb-6">
      <div className="mx-auto lg:w-5xl xl:w-7xl sm:w-xl lg:max-w-7xl px-6 lg:px-8 md:w-3xl md:max-w-3xl">
        <div className="mx-auto max-w-2xl lg:mx-0">
          <h2 className="text-2xl md:text-3xl xl:text-4xl font-semibold tracking-tight text-pretty text-gray-900 dark:text-white">
            Your Cases
          </h2>
          <p className="mt-2 xl:text-lg/8 text-gray-600 dark:text-gray-300">
            Your recently accessed cases are listed below.
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 border-t border-gray-200 pt-10 sm:mt-16 sm:pt-16 lg:mx-0 lg:max-w-none lg:grid-cols-2 xl:grid-cols-3 dark:border-gray-700">
          {data.map((post) => (
            <article
              key={post.accountId}
              className="flex max-w-sm flex-col items-start justify-between hover:scale-[1.01] transition-transform hover:shadow-lg dark:hover:shadow-gray-800 p-6">
              <Link
                href={`/cases/${post.accountId}`}
                className="group flex h-full w-full flex-col">
                <span className="relative inline-flex max-w-full items-center justify-center self-center overflow-hidden text-ellipsis whitespace-nowrap z-10 rounded-full bg-gray-50 px-3 py-1.5 font-medium text-gray-600 hover:bg-gray-100 dark:bg-gray-800/60 dark:text-gray-300 dark:hover:bg-gray-800 text-xs">
                  {post.caseNumber || post.record?.caseNumber || 'Case Details'}
                </span>
                <div className="group relative grow">
                  <h3 className="mt-3 xl:text-lg/6 font-semibold text-gray-900 group-hover:text-gray-600 dark:text-white dark:group-hover:text-gray-300">
                    <span className="absolute inset-0" />
                    {printTitle(post.record)}
                  </h3>
                  <p className="mt-5 line-clamp-3 text-sm/6 text-gray-600 dark:text-gray-400">
                    {post.record?.description}
                  </p>
                </div>
                <footer className="relative mt-auto w-full pt-4">
                  <div className="text-sm/6">
                    <p className="font-thin text-gray-900 dark:text-white">
                      <span className="absolute inset-0" />
                      {post.record?.personInformation?.firstName}{' '}
                      {post.record?.personInformation?.lastName} (
                      {post.record?.filingRole}){' '}
                    </p>
                    <p className="font-thin text-gray-900 dark:text-white">
                      <span className="absolute inset-0" />
                      Attorney:{' '}
                      {!post.record?.currentAttorney?.firstName &&
                      !post.record?.currentAttorney?.lastName
                        ? 'Unassigned'
                        : `${post.record?.currentAttorney?.firstName} ${post.record?.currentAttorney?.lastName}`}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      {post.isGuest
                        ? 'Guest'
                        : isAttorney
                          ? 'Attorney'
                          : 'Client'}
                    </p>
                  </div>
                </footer>
              </Link>
            </article>
          ))}
          <article className="max-w-sm">
            {canCreateCase ? (
              <Link
                href="/cases/create"
                className="group flex h-full w-full flex-col items-center justify-between rounded-xl border-2 border-dashed border-gray-300 p-6 transition-transform hover:scale-[1.01] hover:shadow-lg dark:border-gray-700 dark:hover:shadow-gray-800">
                <div className="flex place-content-center text-xs w-full">
                  <span className="relative z-10 rounded-full bg-blue-50 px-3 py-1.5 font-medium text-blue-700 group-hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 dark:group-hover:bg-blue-900/60">
                    New Case
                  </span>
                </div>
                <div className="relative flex grow w-full flex-col items-center">
                  <h3 className="mt-3 text-center xl:text-lg/6 font-semibold text-gray-900 group-hover:text-gray-600 dark:text-white dark:group-hover:text-gray-300">
                    Create Case
                  </h3>
                  <div
                    className="mt-5 flex w-full flex-1 items-center justify-center text-gray-600 dark:text-gray-400"
                    aria-hidden="true">
                    <GavelIcon className="h-24 w-24" />
                  </div>
                  <span className="sr-only">Create a new case</span>
                </div>
              </Link>
            ) : (
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="flex h-full w-full cursor-not-allowed flex-col items-center justify-between rounded-xl border-2 border-dashed border-gray-300 p-6 opacity-70 dark:border-gray-700">
                <div className="flex place-content-center text-xs w-full">
                  <span className="relative z-10 rounded-full bg-blue-50 px-3 py-1.5 font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    New Case
                  </span>
                </div>
                <div className="relative flex grow w-full flex-col items-center">
                  <h3 className="mt-3 text-center xl:text-lg/6 font-semibold text-gray-900 dark:text-white">
                    Create Case
                  </h3>
                  <div
                    className="mt-5 flex w-full flex-1 items-center justify-center text-gray-600 dark:text-gray-400"
                    aria-hidden="true">
                    <GavelIcon className="h-24 w-24" />
                  </div>
                  {createCaseWarning ? (
                    <p className="mt-3 text-center text-xs text-amber-700 dark:text-amber-300">
                      {createCaseWarning}
                    </p>
                  ) : null}
                  <span className="sr-only">Create a new case</span>
                </div>
              </button>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}
