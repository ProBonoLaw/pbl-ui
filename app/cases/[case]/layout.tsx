import CaseSideNavigation from '@/components/cases/CaseSideNavigation';
import CaseTermsGate from '@/components/cases/CaseTermsGate';
import type { ReactNode } from 'react';

export default async function CaseLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<{ case: string }>;
}>) {
  const { case: caseId } = await params;

  return (
    <CaseTermsGate caseId={caseId}>
      <CaseSideNavigation caseId={caseId} />
      {children}
    </CaseTermsGate>
  );
}
