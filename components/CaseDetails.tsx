import type { UserAccountModel } from '../lib/types';
import {
  canSeeCaseDeclarationNavigation,
  canSeeCaseArgumentNavigation,
  canSeeCaseDocumentsNavigation,
  canSeeCaseQaNavigation,
  canSeeCaseShareNavigation,
  canSeeCaseTimelineNavigation,
  shouldHideEditAndStatistics,
} from '@/lib/navigationAccess';
import { printTitle } from '@/lib/caseUtils';
import { PrimaryListLink, StackedListItem, StatusBadge } from './lists/StackedList';

export default function CaseDetails({ caseItem, agreedToTerms }: { caseItem: UserAccountModel['casesAccounts'][0]; agreedToTerms?: boolean | null }) {
  const record = caseItem.record;
  if (!record) {
    return <StackedListItem title="Case unavailable" description="No case record available." />;
  }

  const headliner = printTitle(record);
  const href = `/cases/${record.accountId}`;
  const isGuest = caseItem.isGuest === true;
  const navigationAccess = {
    agreedToCaseTerms: caseItem.agreedToCaseTerms,
    isGuest,
    canUseQA: caseItem.canUseQA,
    canGenerateDeclaration: caseItem.canGenerateDeclaration,
    canAccessDocuments: caseItem.canAccessDocuments,
  };
  const canSeeQa = canSeeCaseQaNavigation(navigationAccess);
  const canSeeDeclarations = canSeeCaseDeclarationNavigation(navigationAccess);
  const canSeeArguments = canSeeCaseArgumentNavigation(navigationAccess);
  const canSeeTimeline = canSeeCaseTimelineNavigation(navigationAccess);
  const canSeeDocuments = canSeeCaseDocumentsNavigation(navigationAccess);
  const canSeeShare = canSeeCaseShareNavigation(navigationAccess);
  const canSeeStatistics = !shouldHideEditAndStatistics({
    agreedToTerms: agreedToTerms ?? false,
    agreedToCaseTerms: caseItem.agreedToCaseTerms,
    isGuest,
  });

  return (
    <StackedListItem
      title={headliner}
      badge={
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <StatusBadge tone="blue">{record.filingRole || 'Case'}</StatusBadge>
          {isGuest && <StatusBadge tone="gray">Shared</StatusBadge>}
        </span>
      }
      description={record.description || undefined}
      metadata={[
        `Case number: ${record.caseNumber || 'N/A'}`,
        `Location: ${record.county || 'N/A'}, ${record.state || 'N/A'}`,
      ]}
      primaryAction={<PrimaryListLink href={href}>View</PrimaryListLink>}
      menuLabel={`Options for ${headliner}`}
      menuActions={[
        ...(canSeeShare ? [{ label: 'Share', href: `${href}/share` }] : []),
        ...(canSeeQa ? [{ label: 'QA Bot', href: `${href}/qa` }] : []),
        ...(canSeeDocuments ? [{ label: 'Manage Documents', href: `${href}/documents` }] : []),
        ...(canSeeArguments ? [
          { label: 'View Arguments', href: `${href}/argument-builder` },
          { label: 'Prepare Argument', href: `${href}/argument-builder/request` },
        ] : []),
        ...(canSeeTimeline ? [{ label: 'Timeline Builder', href: `${href}/timeline` }] : []),
        ...(canSeeDeclarations ? [
          { label: 'View Declarations', href: `${href}/declarations` },
          { label: 'Prepare Declaration', href: `${href}/declarations/request` },
        ] : []),
        ...(canSeeStatistics ? [{ label: 'Statistics', href: `${href}/usage` }] : []),
      ]}
    />
  );
}
