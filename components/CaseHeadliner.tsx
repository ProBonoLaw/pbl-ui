'use client';
import { printTitle } from '@/lib/caseUtils';
import { OriginalCaseRecord } from '@/lib/types';

export default function CaseHeadliner({
  caseDetails,
  pageTitle,
  variant = 'default',
  flush = false,
}: Readonly<{
  caseDetails?: OriginalCaseRecord;
  pageTitle?: string;
  variant?: 'default' | 'compact' | 'side-navigation';
  flush?: boolean;
}>) {
  if (!caseDetails) {
    return (
      <div
        className={
          variant === 'default'
            ? undefined
            : 'text-xs text-gray-500 dark:text-gray-400'
        }>
        Loading case...
      </div>
    );
  }

  const hasNickname = (caseDetails.nickname ?? '').trim() !== '';
  const normalizedCaseNumber = (caseDetails.caseNumber ?? '').trim();
  const caseNumber =
    normalizedCaseNumber.length > 0 ? normalizedCaseNumber : 'N/A';
  const title = printTitle(caseDetails);

  const isCondensed = variant !== 'default';
  const isSideNavigation = variant === 'side-navigation';
  const primaryText = isSideNavigation ? title : (pageTitle ?? 'Case');
  let secondaryText: string;
  if (isSideNavigation) {
    secondaryText = caseNumber;
  } else if (hasNickname) {
    secondaryText = title;
  } else {
    secondaryText = `${title} (${caseNumber})`;
  }

  return (
    <div
      className={
        isCondensed
          ? 'flex min-w-0 flex-col gap-0.5'
          : `${flush ? '' : 'm-2 '}flex flex-col content-center self-center space-x-2`
      }>
      <div
        className={
          isCondensed
            ? 'truncate text-sm font-semibold text-gray-900 dark:text-white'
            : 'text-xl font-bold md:text-2xl'
        }>
        {primaryText}
      </div>
      <div
        className={
          isCondensed
            ? 'truncate text-xs text-gray-600 dark:text-gray-400'
            : 'text-base md:text-2xl'
        }>
        {secondaryText}
      </div>
    </div>
  );
}
