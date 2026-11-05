import { usePathname, useRouter } from 'next/navigation';

import { useEffect, useState } from 'react';
import AuthGuard from '../AuthGuard';
import PageTemplate from '../PageTemplate';
import TermsOfServiceModal from '../TermsOfServiceModal';
import { useAccountAccess } from '@/hooks/useAccountAccess';
import { getCachedCaseAccount } from '@/lib/caseAccountRequestCache';
import { useAuth } from '@/hooks/useAuth';
import { getCaseRouteRedirectPath } from '@/lib/navigationAccess';
import { cn } from '@/lib/cssHelper';
import {
  getTermsTypeForBillingCode,
  type TermsOfServiceType,
} from '@/lib/termsOfService';

export default function CasePageTemplate({
  params,
  title,
  children,
  actionSection,
  actionNotice,
  isLoading,
  pageClassName,
  contentClassName,
  contentScrollable = true,
  showBreadcrumbs = false,
  currentPath = undefined,
}: Readonly<{
  params: Promise<{ case: string }>;
  title: string | React.ReactNode;
  children: React.ReactNode;
  actionSection?: React.ReactNode;
  actionNotice?: React.ReactNode;
  isLoading?: boolean;
  pageClassName?: string;
  contentClassName?: string;
  contentScrollable?: boolean;
  showBreadcrumbs?: boolean;
  currentPath?: string[];
}>) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(true);
  const [agreedToCaseTerms, setAgreedToCaseTerms] = useState<boolean>(false);
  const [showCaseTermsModal, setShowCaseTermsModal] = useState<boolean>(false);
  const [caseTermsType, setCaseTermsType] =
    useState<TermsOfServiceType>('general');
  const [canUseQA, setCanUseQA] = useState<boolean>(false);
  const [canGenerateDeclaration, setCanGenerateDeclaration] =
    useState<boolean>(false);
  const [canAccessDocuments, setCanAccessDocuments] = useState<boolean>(false);
  const [caseAccessResolved, setCaseAccessResolved] = useState<boolean>(false);
  const { account, fetchWithAuth, isAuthenticated } = useAuth();
  const { loading: loadingAccess } = useAccountAccess({
    enabled: isAuthenticated,
  });
  const router = useRouter();
  const accountCacheScope =
    account?.homeAccountId || account?.localAccountId || account?.username;

  useEffect(() => {
    params.then((p) => setCaseId(p.case));
  }, [params]);

  useEffect(() => {
    if (!isAuthenticated || !caseId || loadingAccess) {
      return;
    }

    // Reset the route access state while the current case is being resolved.
    setIsGuest(true);
    setAgreedToCaseTerms(false);
    setShowCaseTermsModal(false);
    setCaseTermsType('general');
    setCanUseQA(false);
    setCanGenerateDeclaration(false);
    setCanAccessDocuments(false);
    setCaseAccessResolved(false);

    let canceled = false;
    (async () => {
      try {
        const caseData = await getCachedCaseAccount({
          caseId,
          cacheScope: accountCacheScope,
          fetchWithAuth,
        });
        const caseAccess = caseData.casesAccounts?.[0];
        if (!canceled) {
          const hasAcceptedCaseTerms = caseAccess?.agreedToCaseTerms === true;
          setIsGuest(caseAccess?.isGuest === true);
          setAgreedToCaseTerms(hasAcceptedCaseTerms);
          setShowCaseTermsModal(!hasAcceptedCaseTerms);
          setCaseTermsType(
            getTermsTypeForBillingCode(
              caseAccess?.termsBillingCode ?? caseAccess?.billingCode,
            ),
          );
          setCanUseQA(caseAccess?.canUseQA === true);
          setCanGenerateDeclaration(
            caseAccess?.canGenerateDeclaration === true,
          );
          setCanAccessDocuments(caseAccess?.canAccessDocuments === true);
        }
      } catch {
        // Keep existing defaults if fetch fails.
      } finally {
        if (!canceled) {
          setCaseAccessResolved(true);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [
    accountCacheScope,
    caseId,
    fetchWithAuth,
    isAuthenticated,
    loadingAccess,
  ]);

  const pathname = usePathname();
  useEffect(() => {
    if (!caseAccessResolved || !caseId) {
      return;
    }
    const redirectPath = getCaseRouteRedirectPath(pathname, caseId, {
      agreedToCaseTerms,
      isGuest,
      canUseQA,
      canGenerateDeclaration,
      canAccessDocuments,
    });
    if (redirectPath && pathname !== redirectPath) {
      router.replace(redirectPath);
    }
  }, [
    caseAccessResolved,
    caseId,
    pathname,
    agreedToCaseTerms,
    isGuest,
    canUseQA,
    canGenerateDeclaration,
    canAccessDocuments,
    router,
  ]);

  const acceptCaseTerms = () => {
    setAgreedToCaseTerms(true);
    setShowCaseTermsModal(false);
    if (caseId) {
      globalThis.dispatchEvent(
        new CustomEvent('terms:accepted', {
          detail: { scope: 'case', caseId },
        }),
      );
    }
  };

  return (
    <AuthGuard>
      {caseId && showCaseTermsModal && (
        <TermsOfServiceModal
          opened={true}
          scope="case"
          termsType={caseTermsType}
          caseId={caseId}
          onAccepted={acceptCaseTerms}
          onDeclined={() => router.push('/cases')}
        />
      )}
      <PageTemplate
        title={title}
        actionSection={
          actionNotice || actionSection ? (
            <div data-slot="case-page-actions" className="space-y-3">
              {actionNotice}
              {actionSection}
            </div>
          ) : undefined
        }
        headerContentClassName="pl-4 sm:pl-72"
        isLoading={isLoading}
        showBreadcrumbs={showBreadcrumbs}
        className={pageClassName}
        contentScrollable={contentScrollable}
        currentPath={currentPath}>
        <div className={cn('min-w-0 pl-4 sm:pl-72', contentClassName)}>{children}</div>
      </PageTemplate>
    </AuthGuard>
  );
}
