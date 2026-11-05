'use client';

import {
  BotMessageSquareIcon,
  CircleGaugeIcon,
  FactoryIcon,
  FilePenIcon,
  FolderKanbanIcon,
  GavelIcon,
  Link2Icon,
  LucideLibrarySquare,
  PencilLineIcon,
  HistoryIcon,
  SearchCheck,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import CaseHeadliner from '../CaseHeadliner';
import { useAccountAccess } from '@/hooks/useAccountAccess';
import { useAuth } from '@/hooks/useAuth';
import { getCachedCaseAccount } from '@/lib/caseAccountRequestCache';
import type { CaseMap } from '@/lib/types';
import {
  canSeeCaseArgumentNavigation,
  canSeeCaseDeclarationNavigation,
  canSeeCaseDocumentsNavigation,
  canSeeCaseEvidenceNavigation,
  canSeeCaseQaNavigation,
  canSeeCaseShareNavigation,
  canSeeCaseTimelineNavigation,
  shouldHideEditAndStatistics,
} from '@/lib/navigationAccess';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function CaseSideNavigation({
  caseId,
}: Readonly<{ caseId: string }>) {
  const pathname = usePathname();
  const { account, fetchWithAuth, isAuthenticated } = useAuth();
  const { access, loading: loadingAccess } = useAccountAccess({
    enabled: isAuthenticated,
  });
  const [caseAccess, setCaseAccess] = useState<CaseMap | null>(null);
  const [accessResolved, setAccessResolved] = useState(false);
  const accountCacheScope =
    account?.homeAccountId || account?.localAccountId || account?.username;

  useEffect(() => {
    if (!isAuthenticated || loadingAccess) {
      return;
    }

    setCaseAccess(null);
    setAccessResolved(false);
    let canceled = false;

    async function loadCaseAccess() {
      try {
        const caseData = await getCachedCaseAccount({
          caseId,
          cacheScope: accountCacheScope,
          fetchWithAuth,
        });

        if (!canceled) {
          setCaseAccess(caseData.casesAccounts?.[0] ?? null);
        }
      } catch {
        // Keep the restricted navigation defaults when case access cannot load.
      } finally {
        if (!canceled) {
          setAccessResolved(true);
        }
      }
    }

    void loadCaseAccess();

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

  useEffect(() => {
    const onCaseUpdated = (event: Event) => {
      const detail = (
        event as CustomEvent<{ caseId: string; caseAccess: CaseMap }>
      ).detail;
      if (detail?.caseId === caseId) {
        setCaseAccess(detail.caseAccess);
      }
    };

    globalThis.addEventListener('case:updated', onCaseUpdated);
    return () => globalThis.removeEventListener('case:updated', onCaseUpdated);
  }, [caseId]);

  const isGuest = caseAccess?.isGuest === true;
  const hasAcceptedCaseTerms = caseAccess?.agreedToCaseTerms === true;
  const hideStatistics =
    !accessResolved ||
    shouldHideEditAndStatistics({
      agreedToTerms: access?.agreedToTerms ?? false,
      agreedToCaseTerms: hasAcceptedCaseTerms,
      isGuest,
    });
  const canSeeQa =
    accessResolved &&
    canSeeCaseQaNavigation({
      agreedToCaseTerms: hasAcceptedCaseTerms,
      isGuest,
      canUseQA: caseAccess?.canUseQA,
    });
  const canSeeDeclarations =
    accessResolved &&
    canSeeCaseDeclarationNavigation({
      agreedToCaseTerms: hasAcceptedCaseTerms,
      isGuest,
      canGenerateDeclaration: caseAccess?.canGenerateDeclaration,
    });
  const canSeeArguments =
    accessResolved &&
    canSeeCaseArgumentNavigation({
      agreedToCaseTerms: hasAcceptedCaseTerms,
      isGuest,
      canGenerateDeclaration: caseAccess?.canGenerateDeclaration,
    });
  const canSeeTimeline =
    accessResolved &&
    canSeeCaseTimelineNavigation({
      agreedToCaseTerms: hasAcceptedCaseTerms,
      isGuest,
      canGenerateDeclaration: caseAccess?.canGenerateDeclaration,
    });
  const canSeeDocuments =
    accessResolved &&
    canSeeCaseDocumentsNavigation({
      agreedToCaseTerms: hasAcceptedCaseTerms,
      isGuest,
      canAccessDocuments: caseAccess?.canAccessDocuments,
    });
  const canSeeEvidence =
    accessResolved &&
    canSeeCaseEvidenceNavigation({
      agreedToCaseTerms: hasAcceptedCaseTerms,
      isGuest,
      canAccessDocuments: caseAccess?.canAccessDocuments,
    });
  const canSeeShare =
    accessResolved &&
    canSeeCaseShareNavigation({
      agreedToCaseTerms: hasAcceptedCaseTerms,
      isGuest,
    });

  const navigation = [
    {
      name: 'Details',
      href: `/cases/${caseId}`,
      icon: GavelIcon,
      current:
        pathname === `/cases/${caseId}` ||
        pathname === `/cases/${caseId}/edit`,
      hidden: false,
    },
    {
      name: 'Share',
      href: `/cases/${caseId}/share`,
      icon: Link2Icon,
      current: pathname === `/cases/${caseId}/share`,
      hidden: !canSeeShare,
    },
    {
      name: 'QA Bot',
      href: `/cases/${caseId}/qa`,
      icon: BotMessageSquareIcon,
      current: pathname === `/cases/${caseId}/qa`,
      hidden: !canSeeQa,
    },
    {
      name: 'Manage Documents',
      href: `/cases/${caseId}/documents`,
      icon: LucideLibrarySquare,
      current: pathname.startsWith(`/cases/${caseId}/documents`),
      hidden: !canSeeDocuments,
    },
    {
      name: 'Evidence Explorer',
      href: `/cases/${caseId}/evidence`,
      icon: SearchCheck,
      current: pathname.startsWith(`/cases/${caseId}/evidence`),
      hidden: !canSeeEvidence,
    },
    {
      name: 'View Arguments',
      href: `/cases/${caseId}/argument-builder`,
      icon: FilePenIcon,
      current:
        pathname.startsWith(`/cases/${caseId}/argument-builder`) &&
        pathname !== `/cases/${caseId}/argument-builder/request`,
      hidden: !canSeeArguments,
    },
    {
      name: 'Prepare Argument',
      href: `/cases/${caseId}/argument-builder/request`,
      icon: PencilLineIcon,
      current: pathname === `/cases/${caseId}/argument-builder/request`,
      hidden: !canSeeArguments,
    },
    {
      name: 'Timeline Builder',
      href: `/cases/${caseId}/timeline`,
      icon: HistoryIcon,
      current: pathname.startsWith(`/cases/${caseId}/timeline`),
      hidden: !canSeeTimeline,
    },
    {
      name: 'View Declarations',
      href: `/cases/${caseId}/declarations`,
      icon: FolderKanbanIcon,
      current:
        pathname.startsWith(`/cases/${caseId}/declarations`) &&
        pathname !== `/cases/${caseId}/declarations/request`,
      hidden: !canSeeDeclarations,
    },
    {
      name: 'Prepare Declaration',
      href: `/cases/${caseId}/declarations/request`,
      icon: FactoryIcon,
      current: pathname === `/cases/${caseId}/declarations/request`,
      hidden: !canSeeDeclarations,
    },
    {
      name: 'Statistics',
      href: `/cases/${caseId}/usage`,
      icon: CircleGaugeIcon,
      current: pathname === `/cases/${caseId}/usage`,
      hidden: hideStatistics,
    },
  ].filter((item) => !item.hidden);

  return (
    <aside className="hidden sm:block">
      <nav
        aria-label="Case navigation"
        className="fixed top-20 z-5 h-[calc(100dvh-5rem)] sm:w-60 space-y-1 overflow-y-auto border-r border-gray-200 pr-4  sm:left-[max(2.5rem,calc((100vw-100rem)/2+1rem))] dark:border-white/10">
        <div className="mb-3 border-b border-gray-200 pb-3 dark:border-white/10">
          <CaseHeadliner
            caseDetails={caseAccess?.record}
            variant="side-navigation"
          />
        </div>
        {navigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            aria-current={item.current ? 'page' : undefined}
            className={classNames(
              item.current
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-950 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-100',
              'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            )}>
            <item.icon
              aria-hidden="true"
              className={classNames(
                item.current
                  ? 'text-indigo-600 dark:text-indigo-300'
                  : 'text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300',
                'size-4 shrink-0',
              )}
            />
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
