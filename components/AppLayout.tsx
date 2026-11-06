'use client';

import Menu from '@/components/AppMenu';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import TermsOfServiceModal from '@/components/TermsOfServiceModal';
import { useAccountAccess } from '@/hooks/useAccountAccess';
import { clearAccountCasesCache } from '@/hooks/useAccountCases';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';
import { usePathname } from 'next/navigation';
import { ReactNode, useCallback, useEffect, useState } from 'react';

const PUBLIC_LEGAL_ROUTES = new Set([
  '/privacy',
  '/terms',
  '/baa',
  '/dpa',
  '/aup',
  '/end-client-terms',
]);

export default function AppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const { isAuthenticated, account, fetchWithAuth, signOut } = useAuth();
  const [isInitializationResolved, setIsInitializationResolved] =
    useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(
    null,
  );
  const [hasAcceptedUserTermsInSession, setHasAcceptedUserTermsInSession] =
    useState(false);
  const [demoOfferOpen, setDemoOfferOpen] = useState(false);
  const [demoOfferError, setDemoOfferError] = useState<string | null>(null);
  const [demoOfferSubmitting, setDemoOfferSubmitting] = useState(false);
  const [demoOfferCheckedAccount, setDemoOfferCheckedAccount] = useState<
    string | null
  >(null);

  const homeAccountId = account?.homeAccountId;
  const {
    access,
    loading: loadingAccess,
    error: accessError,
  } = useAccountAccess({
    enabled: isAuthenticated && !!homeAccountId && isInitializationResolved,
  });

  useEffect(() => {
    setHasAcceptedUserTermsInSession(false);
    setDemoOfferOpen(false);
    setDemoOfferError(null);
    setDemoOfferSubmitting(false);
    setDemoOfferCheckedAccount(null);
  }, [homeAccountId]);

  useEffect(() => {
    if (!isAuthenticated || !homeAccountId) {
      setIsInitializationResolved(false);
      setInitializationError(null);
      return;
    }

    let canceled = false;
    setIsInitializationResolved(false);
    setInitializationError(null);

    (async () => {
      try {
        const sessionKey = `isUserInitialized:${homeAccountId}`;
        const isUserInitialized =
          globalThis.sessionStorage.getItem(sessionKey) === 'true';

        if (!isUserInitialized) {
          const response = await fetchWithAuth('/api/accounts/initialize', {
            method: 'POST',
            cache: 'no-store',
          });
          if (!response.ok) {
            const errorText = await response.text();
            logger.error('Error initializing account entry:', errorText);
            if (!canceled) {
              setInitializationError(
                'Unable to verify your account access right now. Please refresh the page or try again later.',
              );
            }
            return;
          }

          globalThis.sessionStorage.setItem(sessionKey, 'true');
          globalThis.dispatchEvent(new CustomEvent('account:initialized'));
        }

        if (!canceled) {
          setIsInitializationResolved(true);
        }
      } catch (error) {
        logger.error('Error initializing account entry:', error);
        if (!canceled) {
          setInitializationError(
            'Unable to verify your account access right now. Please refresh the page or try again later.',
          );
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [fetchWithAuth, homeAccountId, isAuthenticated]);

  const isInitializing =
    isAuthenticated && !!homeAccountId && !isInitializationResolved;
  const isCheckingTerms =
    isAuthenticated &&
    !!homeAccountId &&
    isInitializationResolved &&
    loadingAccess;
  const hasAcceptedUserTerms =
    access?.agreedToTerms === true || hasAcceptedUserTermsInSession;
  const mustAcceptUserTerms =
    isAuthenticated &&
    !!homeAccountId &&
    isInitializationResolved &&
    !loadingAccess &&
    !accessError &&
    !hasAcceptedUserTerms;
  const isPublicLegalRoute = PUBLIC_LEGAL_ROUTES.has(pathname ?? '');
  const shouldRequireUserTerms = mustAcceptUserTerms && !isPublicLegalRoute;
  const shouldBlockApp =
    isInitializing || isCheckingTerms || !!initializationError || !!accessError;
  const shouldHideChildren = shouldBlockApp || shouldRequireUserTerms;

  const checkDemoOffer = useCallback(
    async (isCanceled: () => boolean = () => false) => {
      if (!homeAccountId || demoOfferCheckedAccount === homeAccountId) {
        return;
      }

      setDemoOfferCheckedAccount(homeAccountId);
      setDemoOfferError(null);

      try {
        const response = await fetchWithAuth('/api/accounts/demo-offer', {
          method: 'GET',
          cache: 'no-store',
        });
        if (!response.ok) {
          logger.error(
            'Failed to check demo offer state:',
            await response.text(),
          );
          return;
        }

        const result = (await response.json()) as { shouldOffer?: boolean };
        if (!isCanceled() && result.shouldOffer === true) {
          setDemoOfferOpen(true);
        }
      } catch (error) {
        logger.error('Failed to check demo offer state:', error);
      }
    },
    [demoOfferCheckedAccount, fetchWithAuth, homeAccountId],
  );

  useEffect(() => {
    if (
      !isAuthenticated ||
      !homeAccountId ||
      !isInitializationResolved ||
      loadingAccess ||
      accessError ||
      !hasAcceptedUserTerms ||
      demoOfferCheckedAccount === homeAccountId
    ) {
      return;
    }

    let canceled = false;
    void checkDemoOffer(() => canceled);

    return () => {
      canceled = true;
    };
  }, [
    accessError,
    checkDemoOffer,
    demoOfferCheckedAccount,
    hasAcceptedUserTerms,
    homeAccountId,
    isAuthenticated,
    isInitializationResolved,
    loadingAccess,
  ]);

  async function respondToDemoOffer(acceptedOffer: boolean) {
    if (demoOfferSubmitting) {
      return;
    }

    setDemoOfferSubmitting(true);
    setDemoOfferError(null);
    try {
      const response = await fetchWithAuth('/api/accounts/demo-offer', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ acceptedOffer }),
      });
      if (!response.ok) {
        const details = await response.text();
        throw new Error(details || `${response.status} ${response.statusText}`);
      }

      if (acceptedOffer) {
        clearAccountCasesCache();
        globalThis.dispatchEvent(new CustomEvent('account:cases-changed'));
      }
      setDemoOfferOpen(false);
    } catch (error) {
      logger.error('Failed to respond to demo offer:', error);
      setDemoOfferError(
        'We could not update your demo case preference right now. Please try again later.',
      );
    } finally {
      setDemoOfferSubmitting(false);
    }
  }

  return (
    <>
      {!isInitializing && !initializationError && <Menu />}
      {shouldRequireUserTerms && (
        <TermsOfServiceModal
          opened={true}
          scope="user-account"
          termsType="general"
          onAccepted={() => {
            setHasAcceptedUserTermsInSession(true);
            globalThis.dispatchEvent(
              new CustomEvent('terms:accepted', {
                detail: { scope: 'user-account' },
              }),
            );
            void checkDemoOffer();
          }}
          onDeclined={async () => {
            await signOut();
          }}
          declineText="I Decline"
        />
      )}
      <ConfirmationDialog
        title="Try Demo Cases"
        description={
          demoOfferError ??
          'You do not have any active cases yet. Install the demo cases as shared cases so you can explore the workspace with sample data.'
        }
        confirmButtonText={
          demoOfferSubmitting ? 'Installing...' : 'Install Demo Cases'
        }
        cancelButtonText={demoOfferSubmitting ? 'Please wait' : 'Not now'}
        defaultOpen={demoOfferOpen}
        onClose={(confirmed) => {
          void respondToDemoOffer(confirmed);
        }}
      />
      {shouldBlockApp && (
        <main className="flex min-h-screen items-center justify-center px-6 py-12 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {initializationError ||
              accessError ||
              'Checking your account access...'}
          </p>
        </main>
      )}
      {!shouldHideChildren && children}
    </>
  );
}
