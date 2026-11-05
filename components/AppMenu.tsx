/* eslint-disable @next/next/no-img-element */
'use client';

import { logger } from '@/lib/logger';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { FormActions, FormSection } from '@/components/forms/FormSection';
import { useAccountAccess } from '@/hooks/useAccountAccess';
import { useAuth } from '@/hooks/useAuth';
import { useCase } from '@/hooks/useCase';
import { useAccountCases } from '@/hooks/useAccountCases';
import {
  canSeeCaseDeclarationNavigation,
  canSeeCaseDocumentsNavigation,
  canSeeCaseQaNavigation,
  canSeeCaseShareNavigation,
  canSeeCaseTimelineNavigation,
  canSeeEditAndStatistics,
} from '@/lib/navigationAccess';
import { emitNotification, useEventHandler } from '@/lib/notificationEvents';
import { findRecentPendingFeedbackRequest } from '@/lib/recentFeedbackRequests';
import type { AlertNotice } from '@/lib/types';
import {
  CloseButton,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  MenuButton,
  MenuItem,
  MenuItems,
  Popover,
  PopoverButton,
  PopoverGroup,
  PopoverPanel,
  Menu as Submenu,
} from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import {
  BotMessageSquareIcon,
  ChevronDownIcon,
  CircleQuestionMarkIcon,
  FactoryIcon,
  FolderKanbanIcon,
  FolderSearch,
  GavelIcon,
  HistoryIcon,
  LandmarkIcon,
  Link2Icon,
  LockKeyholeIcon,
  LucideLibrarySquare,
  MessageSquareWarningIcon,
  PencilLineIcon,
  ScrollText,
  ShieldIcon,
  UsersIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSelectedLayoutSegments } from 'next/navigation';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import CaseHeadliner from './CaseHeadliner';
import NotificationsChip from './NotificationsChip';

const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';
const NOTIFICATION_SCOPES = process.env.NEXT_PUBLIC_AAD_API_SCOPE
  ? process.env.NEXT_PUBLIC_AAD_API_SCOPE.split(',').filter(Boolean)
  : ['openid', 'profile'];

function getAccountInitials(name?: string) {
  if (!name) {
    return '?';
  }
  const names = name.split(' ');
  if (names.length === 1) {
    return names[0].charAt(0).toUpperCase();
  }
  return (names[0].charAt(0) + names[1].charAt(0)).toUpperCase();
}

function createFeedbackEndpoint(caseId: string | null) {
  const targetCaseId = caseId ?? EMPTY_UUID;
  return (
    '/api/accounts/cases/' + encodeURIComponent(targetCaseId) + '/feedback'
  );
}

async function submitFeedbackRequest({
  isAuthenticated,
  endpoint,
  formData,
  fetchWithAuth,
}: {
  isAuthenticated: boolean;
  endpoint: string;
  formData: FormData;
  fetchWithAuth: FetchWithAuth;
}) {
  if (!isAuthenticated) {
    return fetch(endpoint, {
      method: 'POST',
      body: formData,
      cache: 'no-store',
    });
  }

  try {
    return await fetchWithAuth(endpoint, {
      method: 'POST',
      body: formData,
      cache: 'no-store',
    });
  } catch (authError) {
    logger.warn(
      'Authenticated feedback submission failed, retrying anonymously:',
      authError,
    );
    return fetch(endpoint, {
      method: 'POST',
      body: formData,
      cache: 'no-store',
    });
  }
}

type Setter<T> = Dispatch<SetStateAction<T>>;

type FeedbackPrompt = {
  accountId: string;
  clientFeedbackRequestId: string;
  notification?: AlertNotice;
};

type FetchWithAuth = (
  input: RequestInfo,
  init?: RequestInit,
  scopes?: string[],
) => Promise<Response>;

type NavigationLink = {
  name: string;
  href: string;
  description?: string;
  icon: React.ElementType;
  hidden?: boolean;
};

type UserNavigationLink = {
  name: string;
  href: string;
  onClick?: () => void;
};

function openFeedbackModalState({
  isAuthenticated,
  setFeedbackEmail,
  setFeedbackError,
  setFeedbackSuccess,
  setIsFeedbackDialogOpen,
}: {
  isAuthenticated: boolean;
  setFeedbackEmail: Setter<string>;
  setFeedbackError: Setter<string | null>;
  setFeedbackSuccess: Setter<string | null>;
  setIsFeedbackDialogOpen: Setter<boolean>;
}) {
  if (isAuthenticated) {
    setFeedbackEmail('');
  }
  setFeedbackError(null);
  setFeedbackSuccess(null);
  setIsFeedbackDialogOpen(true);
}

function closeFeedbackModalState({
  isSubmittingFeedback,
  setIsFeedbackDialogOpen,
}: {
  isSubmittingFeedback: boolean;
  setIsFeedbackDialogOpen: Setter<boolean>;
}) {
  if (isSubmittingFeedback) {
    return;
  }
  setIsFeedbackDialogOpen(false);
}

async function submitFeedbackForm({
  event,
  feedbackMessage,
  feedbackEmail,
  isAuthenticated,
  caseId,
  fetchWithAuth,
  setIsSubmittingFeedback,
  setFeedbackError,
  setFeedbackSuccess,
  setFeedbackMessage,
  setIsFeedbackDialogOpen,
}: {
  event: React.FormEvent<HTMLFormElement>;
  feedbackMessage: string;
  feedbackEmail: string;
  isAuthenticated: boolean;
  caseId: string | null;
  fetchWithAuth: FetchWithAuth;
  setIsSubmittingFeedback: Setter<boolean>;
  setFeedbackError: Setter<string | null>;
  setFeedbackSuccess: Setter<string | null>;
  setFeedbackMessage: Setter<string>;
  setIsFeedbackDialogOpen: Setter<boolean>;
}) {
  event.preventDefault();

  const message = feedbackMessage.trim();
  if (!message) {
    setFeedbackError('Feedback message is required.');
    return;
  }

  setIsSubmittingFeedback(true);
  setFeedbackError(null);
  setFeedbackSuccess(null);

  try {
    const formData = new FormData();
    formData.set('message', message);
    const email = feedbackEmail.trim();
    if (!isAuthenticated && email) {
      formData.set('email', email);
    }

    const endpoint = createFeedbackEndpoint(caseId);
    const response = await submitFeedbackRequest({
      isAuthenticated,
      endpoint,
      formData,
      fetchWithAuth,
    });

    if (!response.ok) {
      const errorText = (await response.text()).trim();
      throw new Error(
        `${response.status} ${response.statusText} ${errorText}`.trim(),
      );
    }

    setFeedbackMessage('');
    setFeedbackError(null);
    setFeedbackSuccess(null);
    setIsFeedbackDialogOpen(false);
  } catch (error) {
    logger.error('Failed to submit nav feedback:', error);
    setFeedbackError('Failed to submit feedback. Please try again.');
  } finally {
    setIsSubmittingFeedback(false);
  }
}

function loadProfilePhotoIfNeeded({
  account,
  profilePhotoUrl,
  loadingPhoto,
  setLoadingPhoto,
  getProfilePhoto,
  setProfilePhotoUrl,
}: {
  account: unknown;
  profilePhotoUrl: string | null | undefined;
  loadingPhoto: boolean;
  setLoadingPhoto: Setter<boolean>;
  getProfilePhoto: () => Promise<string | null | undefined>;
  setProfilePhotoUrl: Setter<string | null | undefined>;
}) {
  if (!account || profilePhotoUrl !== undefined || loadingPhoto) {
    return;
  }

  setLoadingPhoto(true);
  void (async () => {
    try {
      const photoUrl = await getProfilePhoto();
      setProfilePhotoUrl(photoUrl);
    } finally {
      setLoadingPhoto(false);
    }
  })();
}

function syncCaseAccessFlags({
  isAuthenticated,
  userAccess,
  setCanCreateCase,
  setHasAgreedToTerms,
}: {
  isAuthenticated: boolean;
  userAccess:
  | {
    agreedToTerms: boolean;
    isActive: boolean;
  }
  | null
  | undefined;
  setCanCreateCase: Setter<boolean>;
  setHasAgreedToTerms: Setter<boolean>;
}) {
  if (!isAuthenticated || !userAccess) {
    setCanCreateCase(false);
    setHasAgreedToTerms(false);
    return;
  }

  setCanCreateCase(userAccess.agreedToTerms && userAccess.isActive);
  setHasAgreedToTerms(userAccess.agreedToTerms);
}

function buildCaseNavigation({
  isCasePage,
  caseAccessResolved,
  caseId,
  canSeeStatistics,
  canSeeCaseDocuments,
  canSeeCaseQa,
  canSeeCaseDeclarations,
  canSeeCaseTimeline,
  canSeeCaseShare,
}: {
  isCasePage: boolean;
  caseAccessResolved: boolean;
  caseId: string | null;
  canSeeStatistics: boolean;
  canSeeCaseDocuments: boolean;
  canSeeCaseQa: boolean;
  canSeeCaseDeclarations: boolean;
  canSeeCaseTimeline: boolean;
  canSeeCaseShare: boolean;
}): NavigationLink[] {
  if (!isCasePage || !caseAccessResolved) {
    return [];
  }

  return [
    {
      name: 'Details',
      href: `/cases/${caseId}`,
      description: 'View and edit case details',
      icon: GavelIcon,
      hidden: false,
    },
    {
      name: 'Share',
      href: `/cases/${caseId}/share`,
      description: 'Manage case sharing',
      icon: Link2Icon,
      hidden: !canSeeCaseShare,
    },
    {
      name: 'QA Bot',
      href: `/cases/${caseId}/qa`,
      description: 'Chat with your case chatbot',
      icon: BotMessageSquareIcon,
      hidden: !canSeeCaseQa,
    },
    {
      name: 'Manage Documents',
      href: `/cases/${caseId}/documents`,
      description: 'View case documents',
      icon: LucideLibrarySquare,
      hidden: !canSeeCaseDocuments,
    },
    {
      name: 'View Arguments',
      href: `/cases/${caseId}/argument-builder`,
      description: 'View argument requests',
      icon: ScrollText,
      hidden: !canSeeCaseDeclarations,
    },
    {
      name: 'Prepare Argument',
      href: `/cases/${caseId}/argument-builder/request`,
      description: 'Create a new argument builder request',
      icon: PencilLineIcon,
      hidden: !canSeeCaseDeclarations,
    },
    {
      name: 'Timeline Builder',
      href: `/cases/${caseId}/timeline`,
      description: 'Build a chronological case timeline',
      icon: HistoryIcon,
      hidden: !canSeeCaseTimeline,
    },
    {
      name: 'View Declarations',
      href: `/cases/${caseId}/declarations`,
      description: 'View all declarations',
      icon: FolderKanbanIcon,
      hidden: !canSeeCaseDeclarations,
    },
    {
      name: 'Create a Declaration',
      href: `/cases/${caseId}/declarations/request`,
      description: 'Create a new declaration',
      icon: FactoryIcon,
      hidden: !canSeeCaseDeclarations,
    },
    {
      name: 'Statistics',
      href: `/cases/${caseId}/usage`,
      description: 'View case statistics',
      icon: FolderKanbanIcon,
      hidden: !canSeeStatistics,
    },
  ].filter((entry) => !entry.hidden);
}

function buildGeneralCaseNavigation({
  canCreateCase,
  exploreCases,
}: {
  canCreateCase: boolean;
  exploreCases: NavigationLink;
}): NavigationLink[] {
  if (!canCreateCase) {
    return [exploreCases];
  }

  return [
    exploreCases,
    {
      name: 'Create Case',
      href: '/cases/create',
      description: 'Create a new case',
      icon: GavelIcon,
    },
  ];
}

function buildUserNavigation({
  hasAgreedToTerms,
  signOut,
}: {
  hasAgreedToTerms: boolean;
  signOut: () => void;
}): UserNavigationLink[] {
  const userNavigation: UserNavigationLink[] = [];

  if (hasAgreedToTerms) {
    userNavigation.push({
      name: 'Token Usage',
      href: '/cases/usage',
      onClick: undefined,
    });
  }

  userNavigation.push(
    { name: 'Your profile', href: '/profile', onClick: undefined },
    {
      name: 'Sign out',
      href: '#',
      onClick: signOut,
    },
  );

  return userNavigation;
}

function NotificationChipSlot({ show }: Readonly<{ show: boolean }>) {
  if (!show) {
    return null;
  }

  return <NotificationsChip className="mr-2 w-24 md:w-12" />;
}

export default function Menu() {
  const {
    isAuthenticated,
    signIn,
    signOut,
    account,
    getProfilePhoto,
    fetchWithAuth,
  } = useAuth();
  const router = useRouter();
  const { access: userAccess } = useAccountAccess({ enabled: isAuthenticated });
  const { cases: accountCases, loading: accountCasesLoading } = useAccountCases(
    {
      enabled: isAuthenticated,
    },
  );
  const accountInitials = getAccountInitials(account?.name);
  const feedbackPromptAccountKey =
    account?.homeAccountId ?? account?.localAccountId ?? account?.username;

  const segments = useSelectedLayoutSegments();
  const isCasePage =
    segments[0] === 'cases' && !!segments[1] && segments[1] !== 'create';
  const caseId = isCasePage ? segments[1] : null;
  const { caseNumber, caseHeadliner, originalCaseRecord, loading } =
    useCase(caseId);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<
    string | null | undefined
  >(undefined);
  const [loadingPhoto, setLoadingPhoto] = useState<boolean>(false);
  const [canCreateCase, setCanCreateCase] = useState<boolean>(false);
  const [hasAgreedToTerms, setHasAgreedToTerms] = useState<boolean>(false);
  const mobileMenuPanelRef = useRef<HTMLButtonElement>(null);
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackPrompt, setFeedbackPrompt] = useState<FeedbackPrompt | null>(
    null,
  );
  const feedbackPromptAccountRef = useRef<string | null>(null);

  const openFeedbackModal = () =>
    openFeedbackModalState({
      isAuthenticated,
      setFeedbackEmail,
      setFeedbackError,
      setFeedbackSuccess,
      setIsFeedbackDialogOpen,
    });

  const closeFeedbackModal = () =>
    closeFeedbackModalState({
      isSubmittingFeedback,
      setIsFeedbackDialogOpen,
    });

  const submitFeedback = async (event: React.FormEvent<HTMLFormElement>) =>
    submitFeedbackForm({
      event,
      feedbackMessage,
      feedbackEmail,
      isAuthenticated,
      caseId,
      fetchWithAuth,
      setIsSubmittingFeedback,
      setFeedbackError,
      setFeedbackSuccess,
      setFeedbackMessage,
      setIsFeedbackDialogOpen,
    });

  useEventHandler('photo:updated', (event) => {
    setProfilePhotoUrl(event.photoUrl);
  });

  useEventHandler('notify:new', (event) => {
    const notice = event.notice;
    if (
      notice?.notificationType === 'ALERT' &&
      (notice.data.status === 'FEEDBACK_REQUIRED' ||
        notice.data.status === 'FEEDBACK_REQUESTED')
    ) {
      setFeedbackPrompt((currentPrompt) =>
        currentPrompt ?? {
          accountId: notice.data.accountId,
          clientFeedbackRequestId: notice.data.clientFeedbackRequestId,
          notification: notice,
        },
      );
    }
  });

  useEffect(() => {
    if (!isAuthenticated || !feedbackPromptAccountKey) {
      feedbackPromptAccountRef.current = null;
      setFeedbackPrompt(null);
      return;
    }
    const accountKey = feedbackPromptAccountKey;
    if (feedbackPromptAccountRef.current === accountKey) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetchWithAuth(
          '/api/accounts/feedback-requests',
          { method: 'GET', cache: 'no-store' },
          NOTIFICATION_SCOPES,
        );
        if (!response.ok) {
          logger.error(
            'Failed to load recent feedback requests:',
            response.status,
          );
          return;
        }

        const request = findRecentPendingFeedbackRequest(
          await response.json(),
        );
        if (!cancelled && request) {
          setFeedbackPrompt((currentPrompt) =>
            currentPrompt ?? {
              accountId: request.accountId,
              clientFeedbackRequestId: request.id,
            },
          );
        }
      } catch (error) {
        logger.error('Failed to load recent feedback requests:', error);
      } finally {
        if (!cancelled) {
          feedbackPromptAccountRef.current = accountKey;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchWithAuth, feedbackPromptAccountKey, isAuthenticated]);

  const markFeedbackAlertRead = async (alert: AlertNotice) => {
    try {
      const response = await fetchWithAuth(
        `/api/accounts/notifications/${alert.id}?notificationType=${alert.notificationType}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ readAt: new Date() }),
        },
        NOTIFICATION_SCOPES,
      );
      if (!response.ok) {
        logger.error('Failed to mark feedback alert as read:', response.status);
        return;
      }
      emitNotification('notify:read', {
        id: alert.id,
        notificationType: alert.notificationType,
      });
    } catch (error) {
      logger.error('Error marking feedback alert as read:', error);
    }
  };

  useEffect(() => {
    loadProfilePhotoIfNeeded({
      account,
      profilePhotoUrl,
      loadingPhoto,
      setLoadingPhoto,
      getProfilePhoto,
      setProfilePhotoUrl,
    });
  }, [account, getProfilePhoto, profilePhotoUrl, loadingPhoto]);

  useEffect(() => {
    syncCaseAccessFlags({
      isAuthenticated,
      userAccess,
      setCanCreateCase,
      setHasAgreedToTerms,
    });
  }, [isAuthenticated, userAccess]);

  const currentCaseAccess =
    originalCaseRecord?.casesAccounts?.find((ca) => ca.accountId === caseId) ??
    originalCaseRecord?.casesAccounts?.[0];
  const caseAccessResolved = !loading && (!!currentCaseAccess || !isCasePage);
  const isGuestOnCurrentCase = currentCaseAccess?.isGuest === true;
  const hasAcceptedCurrentCaseTerms =
    currentCaseAccess?.agreedToCaseTerms === true;

  const canSeeStatistics = canSeeEditAndStatistics({
    agreedToTerms: hasAgreedToTerms,
    agreedToCaseTerms: hasAcceptedCurrentCaseTerms,
    isGuest: isGuestOnCurrentCase,
  });
  const canSeeCaseQa = canSeeCaseQaNavigation({
    agreedToCaseTerms: hasAcceptedCurrentCaseTerms,
    isGuest: isGuestOnCurrentCase,
    canUseQA: currentCaseAccess?.canUseQA,
  });
  const canSeeCaseDeclarations = canSeeCaseDeclarationNavigation({
    agreedToCaseTerms: hasAcceptedCurrentCaseTerms,
    isGuest: isGuestOnCurrentCase,
    canGenerateDeclaration: currentCaseAccess?.canGenerateDeclaration,
  });
  const canSeeCaseTimeline = canSeeCaseTimelineNavigation({
    agreedToCaseTerms: hasAcceptedCurrentCaseTerms,
    isGuest: isGuestOnCurrentCase,
    canGenerateDeclaration: currentCaseAccess?.canGenerateDeclaration,
  });
  const canSeeCaseDocuments = canSeeCaseDocumentsNavigation({
    agreedToCaseTerms: hasAcceptedCurrentCaseTerms,
    isGuest: isGuestOnCurrentCase,
    canAccessDocuments: currentCaseAccess?.canAccessDocuments,
  });
  const canSeeCaseShare = canSeeCaseShareNavigation({
    agreedToCaseTerms: hasAcceptedCurrentCaseTerms,
    isGuest: isGuestOnCurrentCase,
  });

  const exploreCases = {
    name: 'Explorer',
    href: '/cases',
    description: 'Explore other cases',
    icon: FolderSearch,
    hidden: !isAuthenticated,
  };

  const createCase = {
    name: 'Create Case',
    href: '/cases/create',
    description: 'Create a new case',
    icon: GavelIcon,
    hidden: !isAuthenticated || !canCreateCase,
  };

  const legalNavigation: NavigationLink[] = [
    {
      name: 'Privacy and Security',
      href: '/privacy',
      description: 'Privacy policy and security materials',
      icon: LockKeyholeIcon,
    },
    {
      name: 'Terms of Service',
      href: '/terms',
      description: 'Terms governing use of ProBono Law',
      icon: ScrollText,
    },
    {
      name: 'Business Associate Agreement',
      href: '/baa',
      description: 'Business associate agreement',
      icon: ShieldIcon,
    },
    {
      name: 'Data Processing Addendum',
      href: '/dpa',
      description: 'Data processing terms',
      icon: LockKeyholeIcon,
    },
    {
      name: 'Acceptable Use Policy',
      href: '/aup',
      description: 'Acceptable use requirements',
      icon: ShieldIcon,
    },
    {
      name: 'End-Client Terms',
      href: '/end-client-terms',
      description: 'Terms for non-attorney end clients',
      icon: UsersIcon,
    },
  ];

  const navigation = [
    {
      ...exploreCases,
      name: 'Case Management',
      hidden: !isAuthenticated || isCasePage,
    },
    {
      ...createCase,
      hidden: !isAuthenticated || isCasePage || !canCreateCase,
    },
    {
      name: 'Feedback Center',
      href: '/feedback',
      icon: MessageSquareWarningIcon,
      hidden: !isAuthenticated,
    },
    { name: 'Product', href: '/product', icon: ShieldIcon, hidden: false },
    {
      name: 'FAQ',
      href: '/faq',
      icon: CircleQuestionMarkIcon,
      hidden: false,
    },
    // Temporarily hiding About Us until we have content ready for those pages
    {
      name: 'About Us',
      href: '/about-us',
      icon: LandmarkIcon,
      hidden: true,
    },
    {
      name: 'Our Staff',
      href: '/staff',
      icon: UsersIcon,
      hidden: false,
    },
  ];

  const primaryNavigation = navigation.filter(
    (item) => item.href !== '/cases' && item.href !== '/cases/create',
  );

  const caseNavigation = buildCaseNavigation({
    isCasePage,
    caseAccessResolved,
    caseId,
    canSeeStatistics,
    canSeeCaseDocuments,
    canSeeCaseQa,
    canSeeCaseDeclarations,
    canSeeCaseTimeline,
    canSeeCaseShare,
  });

  const generalCaseNavigation = buildGeneralCaseNavigation({
    canCreateCase,
    exploreCases,
  });

  const userNavigation = buildUserNavigation({
    hasAgreedToTerms,
    signOut,
  });

  const notificationChip = <NotificationChipSlot show={!!account} />;
  return (
    <>
      <div
        aria-hidden="true"
        className="h-[calc(4rem+env(safe-area-inset-top))] sm:hidden"
      />
      <div className="fixed inset-x-0 top-0 z-50 w-full sm:sticky sm:top-0">
        <Disclosure
          as="nav"
          className="border-b border-gray-200 bg-white pt-[env(safe-area-inset-top)] dark:border-white/10 dark:bg-gray-900 sm:pt-0">
          <div className="mx-auto xl:max-w-7xl lg:max-w-5xl md:max-w-4xl px-6 md:px-0">
            <div className="flex h-16 justify-between">
              <div className="flex">
                <Link href="/" className="m-1.5 p-1.5">
                  <span className="sr-only">ProBono Law</span>
                  <img
                    alt=""
                    src="/ProBonoLawLogo.png"
                    className="h-12  w-auto dark:hidden"
                  />
                  <img
                    alt=""
                    src="/ProBonoLawLogo-dark.png"
                    className="h-12 w-auto not-dark:hidden"
                  />
                </Link>
                <div className="hidden lg:flex lg:gap-x-12 z-50">
                  <PopoverGroup className="hidden lg:flex lg:item-center lg:gap-x-12">
                    <Popover
                      className="relative items-center pt-5"
                      hidden={!isAuthenticated}>
                      <PopoverButton className="flex items-center gap-x-1 text-sm/6 font-semibold text-gray-900 dark:text-white">
                        Cases
                        <ChevronDownIcon
                          aria-hidden="true"
                          className="size-5 flex-none text-gray-400 dark:text-gray-500"
                        />
                      </PopoverButton>
                      <PopoverPanel
                        transition
                        focus
                        className="fixed inset-x-0 top-16 z-20 w-screen max-w-none overflow-hidden rounded-3xl bg-white shadow-lg outline-1 outline-gray-900/5 transition data-closed:translate-y-1 data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10">
                        <div className="mx-auto max-w-[100rem] p-6">
                          <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                              Your cases
                            </h2>
                          </div>
                          {accountCasesLoading ? (
                            <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
                              Loading cases...
                            </p>
                          ) : accountCases.length === 0 ? (
                            <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
                              No cases available.
                            </p>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {accountCases.map((caseItem) => {
                                if (!caseItem.record?.accountId) {
                                  return null;
                                }

                                return (
                                  <CloseButton
                                    key={caseItem.accountId}
                                    href={`/cases/${caseItem.record.accountId}`}
                                    as={Link}
                                    className="block rounded-md  bg-white p-3 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50 dark:border-white/10 dark:bg-gray-800 dark:hover:border-indigo-400/40 dark:hover:bg-white/5">
                                    <CaseHeadliner
                                      caseDetails={caseItem.record}
                                      pageTitle={caseItem.caseNumber}
                                      variant="compact"
                                    />
                                  </CloseButton>
                                );
                              })}
                            </div>
                          )}
                          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
                            {generalCaseNavigation.map((item) => (
                              <CloseButton
                                key={item.name}
                                href={item.href}
                                as={Link}
                                className="group flex items-center gap-3 rounded-md p-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5">
                                <item.icon
                                  aria-hidden="true"
                                  className="size-5 text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300"
                                />
                                {item.name}
                              </CloseButton>
                            ))}
                          </div>
                        </div>
                      </PopoverPanel>
                    </Popover>
                    {primaryNavigation
                      .filter((item) => !item.hidden)
                      .map((item) => (
                        <div key={item.name} className="flex items-center">
                          <Link
                            href={item.href}
                            className="text-sm/6 font-semibold text-gray-900 dark:text-white hover:bg-gray-50 hover:dark:bg-white/20 hover:cursor-pointer hover:text-black dark:hover:text-white">
                            {item.name}
                          </Link>
                        </div>
                      ))}
                    <Popover className="relative items-center pt-5">
                      <PopoverButton
                        aria-label="Open legal menu"
                        className="flex items-center gap-x-1 text-sm/6 font-semibold text-gray-900 dark:text-white">
                        Legal
                        <ChevronDownIcon
                          aria-hidden="true"
                          className="size-5 flex-none text-gray-400 dark:text-gray-500"
                        />
                      </PopoverButton>
                      <PopoverPanel
                        transition
                        focus
                        className="absolute left-0 top-full z-20 mt-2 w-80 overflow-hidden rounded-2xl bg-white p-3 shadow-lg outline-1 outline-gray-900/5 transition data-closed:translate-y-1 data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10">
                        <h2 className="px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white">
                          Agreements and policies
                        </h2>
                        <div className="mt-1 space-y-1">
                          {legalNavigation.map((item) => (
                            <CloseButton
                              key={item.name}
                              as={Link}
                              href={item.href}
                              className="group flex items-start gap-3 rounded-md p-3 text-left hover:bg-gray-50 dark:hover:bg-white/5">
                              <item.icon
                                aria-hidden="true"
                                className="mt-0.5 size-5 shrink-0 text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300"
                              />
                              <span>
                                <span className="block text-sm font-medium text-gray-900 dark:text-white">
                                  {item.name}
                                </span>
                                {item.description ? (
                                  <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                                    {item.description}
                                  </span>
                                ) : null}
                              </span>
                            </CloseButton>
                          ))}
                        </div>
                      </PopoverPanel>
                    </Popover>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={openFeedbackModal}
                        className="text-sm/6 font-semibold text-gray-900 dark:text-white hover:bg-gray-50 hover:dark:bg-white/20 hover:cursor-pointer hover:text-black dark:hover:text-white">
                        Feedback
                      </button>
                    </div>
                  </PopoverGroup>
                </div>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:items-center">
                {isAuthenticated ? (
                  <>
                    {notificationChip}
                    <Submenu as="div" className="relative ml-3">
                      <MenuButton className="relative flex max-w-xs items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-500">
                        <span className="absolute -inset-1.5" />
                        <span className="sr-only">Open user menu</span>
                        {profilePhotoUrl ? (
                          <img
                            alt=""
                            src={profilePhotoUrl}
                            className="size-8 rounded-full outline -outline-offset-1 outline-black/5 dark:outline-white/10"
                          />
                        ) : (
                          <div className="size-8 rounded-full bg-gray-200 dark:bg-gray-700/50 flex items-center justify-center outline -outline-offset-1 outline-black/5 dark:outline-white/10">
                            <span className="text-gray-500 dark:text-gray-400">
                              {accountInitials}
                            </span>
                          </div>
                        )}
                      </MenuButton>

                      <MenuItems
                        transition
                        className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg outline outline-black/5 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-75 data-leave:ease-in dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10">
                        {userNavigation.map((item) => (
                          <MenuItem key={item.name}>
                            <a
                              onClick={item.onClick}
                              href={item.href}
                              className="block px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:outline-hidden dark:text-gray-300 dark:data-focus:bg-white/5">
                              {item.name}
                            </a>
                          </MenuItem>
                        ))}
                      </MenuItems>
                    </Submenu>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={signIn}
                    className="text-sm/6 font-semibold text-gray-900 dark:text-white hover:cursor-pointer">
                    Log in
                  </button>
                )}
              </div>
              <div className="-mr-2 flex items-center sm:hidden">
                {/* Mobile menu button */}
                <DisclosureButton className="group relative inline-flex items-center justify-center rounded-md bg-white p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-2 focus:outline-offset-2 focus:outline-indigo-600 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white dark:focus:outline-indigo-500">
                  <span className="absolute -inset-0.5" />
                  <span className="sr-only">Open main menu</span>
                  <Bars3Icon
                    aria-hidden="true"
                    className="block size-6 group-data-open:hidden"
                  />
                  <XMarkIcon
                    aria-hidden="true"
                    className="hidden size-6 group-data-open:block"
                  />
                </DisclosureButton>
              </div>
            </div>
          </div>

          <DisclosurePanel className="sm:hidden sm:mb-4">
            <CloseButton ref={mobileMenuPanelRef}></CloseButton>
            <div className="mt-6 flow-root mb-4">
              <div className="-my-6 divide-y divide-gray-500/10 dark:divide-white/10">
                <div className="space-y-2 py-6">
                  <Disclosure
                    as="div"
                    className="-mx-3"
                    hidden={!isAuthenticated}>
                    <DisclosureButton className="group flex w-full items-center justify-between rounded-lg py-2 pr-3.5 pl-6 text-base/7 font-semibold text-gray-900 hover:bg-gray-50 dark:text-white dark:hover:bg-white/5">
                      <span>
                        <ScrollText className="size-5 inline-block mr-1 mb-1" />
                        {isCasePage ? 'Case Management' : 'Case'}
                      </span>
                      <ChevronDownIcon
                        aria-hidden="true"
                        className="size-5 flex-none group-data-open:rotate-180"
                      />
                    </DisclosureButton>
                    <DisclosurePanel
                      className="mt-2 space-y-2"
                      onBlur={() => {
                        setTimeout(() => {
                          mobileMenuPanelRef?.current?.click();
                        }, 0);
                      }}>
                      <div hidden={!isCasePage}>
                        <div className="flex items-center bg-gray-50 px-4 py-2 dark:bg-gray-700/50">
                          <span className="text-sm/6 text-gray-500 dark:text-gray-400">
                            {caseHeadliner} &mdash; {caseNumber}
                          </span>
                        </div>
                      </div>
                      {[
                        ...(isCasePage
                          ? caseNavigation
                          : generalCaseNavigation),
                      ].map((item) => (
                        <CloseButton
                          key={item.name}
                          as={Link}
                          href={item.href}
                          className="block rounded-lg py-2 pr-3 pl-10 text-sm/7 font-semibold text-gray-900 hover:bg-gray-50 dark:text-white dark:hover:bg-white/5">
                          <div className="flex items-center">
                            <item.icon className="mr-2" />
                            {item.name}
                          </div>
                        </CloseButton>
                      ))}
                      <div
                        hidden={!isCasePage}
                        className="border-t border-gray-200 dark:border-gray-700">
                        {generalCaseNavigation.map((generalLinks) => (
                          <CloseButton
                            key={generalLinks.name}
                            as={Link}
                            href={generalLinks.href}
                            className="block rounded-lg py-2 pr-3 pl-6 text-sm/7 font-semibold text-gray-900 hover:bg-gray-50 dark:text-white dark:hover:bg-white/5">
                            <div className="flex items-center">
                              <generalLinks.icon className="mr-2" />
                              {generalLinks.name}
                            </div>
                          </CloseButton>
                        ))}
                      </div>
                    </DisclosurePanel>
                  </Disclosure>
                  {primaryNavigation.map((item) => (
                    <DisclosureButton
                      key={item.name}
                      href={item.href}
                      hidden={item.hidden}
                      as={Link}
                      className="-mx-3 block rounded-lg pl-6 py-2 text-base/7 font-semibold text-gray-900 hover:bg-gray-50 dark:text-white dark:hover:bg-white/5 transition delay-150 duration-300">
                      <div className="flex items-center">
                        <item.icon className="mr-2" />
                        {item.name}
                      </div>
                    </DisclosureButton>
                  ))}
                  <Disclosure as="div" className="-mx-3">
                    <DisclosureButton className="group flex w-full items-center justify-between rounded-lg py-2 pr-3.5 pl-6 text-base/7 font-semibold text-gray-900 hover:bg-gray-50 dark:text-white dark:hover:bg-white/5">
                      <span>
                        <ScrollText className="mr-1 mb-1 inline-block size-5" />
                        Legal
                      </span>
                      <ChevronDownIcon
                        aria-hidden="true"
                        className="size-5 flex-none group-data-open:rotate-180"
                      />
                    </DisclosureButton>
                    <DisclosurePanel className="mt-2 space-y-2">
                      {legalNavigation.map((item) => (
                        <CloseButton
                          key={item.name}
                          as={Link}
                          href={item.href}
                          className="block rounded-lg py-2 pr-3 pl-10 text-sm/7 font-semibold text-gray-900 hover:bg-gray-50 dark:text-white dark:hover:bg-white/5">
                          <div className="flex items-center">
                            <item.icon className="mr-2 size-5" />
                            {item.name}
                          </div>
                        </CloseButton>
                      ))}
                    </DisclosurePanel>
                  </Disclosure>
                  <button
                    type="button"
                    onClick={() => {
                      openFeedbackModal();
                      mobileMenuPanelRef.current?.click();
                    }}
                    className="-mx-3 block w-full rounded-lg pl-6 py-2 text-left text-base/7 font-semibold text-gray-900 hover:bg-gray-50 dark:text-white dark:hover:bg-white/5 transition delay-150 duration-300">
                    <div className="flex items-center">
                      <BotMessageSquareIcon className="mr-2" />
                      Feedback
                    </div>
                  </button>
                </div>
                <div className="border-t border-gray-200 pt-4 pb-3 dark:border-gray-700">
                  {isAuthenticated ? (
                    <>
                      <div className="flex items-center px-4">
                        <div className="shrink-0">
                          {profilePhotoUrl ? (
                            <img
                              alt=""
                              src={profilePhotoUrl}
                              className="size-10 rounded-full outline -outline-offset-1 outline-black/5 dark:outline-white/10"
                            />
                          ) : null}
                        </div>
                        <div className="ml-3">
                          <div className="text-base font-medium text-gray-800 dark:text-white">
                            {account?.name}
                          </div>
                        </div>

                        <div className="relative ml-auto shrink-0 rounded-full p-1 text-gray-400 hover:text-gray-500 focus:outline-2 focus:outline-offset-2 focus:outline-indigo-600 dark:text-gray-400 dark:hover:text-white dark:focus:outline-indigo-500">
                          {notificationChip}
                        </div>
                      </div>
                      <div className="mt-3 space-y-1">
                        {userNavigation.map((item) => (
                          <a
                            key={item.name}
                            href={item.href}
                            onClick={item.onClick}
                            className="block px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200">
                            {item.name}
                          </a>
                        ))}
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={signIn}
                      className="text-sm/6 font-semibold text-gray-900 dark:text-white hover:cursor-pointer px-4 pb-2">
                      Log in
                    </button>
                  )}
                </div>
              </div>
            </div>
          </DisclosurePanel>
        </Disclosure>
      </div>
      <Dialog
        open={isFeedbackDialogOpen}
        onClose={closeFeedbackModal}
        className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/40" />
        <div className="fixed inset-0 overflow-y-auto p-4">
          <div className="flex min-h-full items-center justify-center">
            <DialogPanel className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800 dark:outline dark:-outline-offset-1 dark:outline-white/10">
              <DialogTitle className="text-base font-semibold text-gray-900 dark:text-white">
                Feedback
              </DialogTitle>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Share feedback about the app. Screenshots are not included from
                this form. If you want to include a screenshot, cancel this
                dialog and toggle &quot;Feedback Mode&quot; instead.
              </p>
              <form onSubmit={submitFeedback} className="mt-6 space-y-8">
                <FormSection title="Feedback Details" description="Tell us what happened or what could improve." fieldsClassName="space-y-4">
                  <div>
                    <label
                      htmlFor="feedback-message"
                      className="mb-1 block text-sm font-medium text-gray-900 dark:text-white">
                      Message
                    </label>
                    <textarea
                      id="feedback-message"
                      value={feedbackMessage}
                      onChange={(event) => setFeedbackMessage(event.target.value)}
                      disabled={isSubmittingFeedback}
                      required
                      rows={5}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  {!isAuthenticated && (
                    <div>
                      <label
                        htmlFor="feedback-email"
                        className="mb-1 block text-sm font-medium text-gray-900 dark:text-white">
                        Email (optional)
                      </label>
                      <input
                        id="feedback-email"
                        type="email"
                        value={feedbackEmail}
                        onChange={(event) => setFeedbackEmail(event.target.value)}
                        disabled={isSubmittingFeedback}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  )}
                </FormSection>
                {feedbackError && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {feedbackError}
                  </p>
                )}
                {feedbackSuccess && (
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {feedbackSuccess}
                  </p>
                )}
                <FormActions>
                  <button
                    type="button"
                    onClick={closeFeedbackModal}
                    disabled={isSubmittingFeedback}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingFeedback}
                    className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400">
                    {isSubmittingFeedback ? 'Sending...' : 'Send Feedback'}
                  </button>
                </FormActions>
              </form>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
      <ConfirmationDialog
        title="Provide speaker-name feedback?"
        description="A transcript needs your help identifying its speakers. Would you like to open the Feedback Center now?"
        confirmButtonText="Open Feedback Center"
        cancelButtonText="Not now"
        defaultOpen={feedbackPrompt !== null}
        onClose={(confirmed) => {
          const prompt = feedbackPrompt;
          setFeedbackPrompt(null);
          if (!prompt || !confirmed) {
            return;
          }

          if (prompt.notification) {
            void markFeedbackAlertRead(prompt.notification);
          }
          router.push(
            `/cases/${encodeURIComponent(prompt.accountId)}/feedback/${encodeURIComponent(prompt.clientFeedbackRequestId)}`,
          );
        }}
      />
    </>
  );
}
