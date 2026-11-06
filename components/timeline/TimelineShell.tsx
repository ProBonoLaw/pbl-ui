'use client';

import CasePageTemplate from '@/components/cases/CasePageTemplate';
import TimelineModeSelector from '@/components/timeline/TimelineModeSelector';
import AiOutputNotice from '@/components/AiOutputNotice';
import { use } from 'react';

export default function TimelineShell({
  params,
  children,
}: Readonly<{
  params: Promise<{ case: string }>;
  children: React.ReactNode;
}>) {
  const { case: caseId } = use(params);

  return (
    <CasePageTemplate
      title="Timeline Builder"
      params={params}
      actionNotice={<AiOutputNotice />}>
      <div className="w-full space-y-6">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Build a chronological, source-linked view of the case. Realtime is
          best for an immediate working timeline; investigative runs a deeper
          background request.
        </p>
        <TimelineModeSelector caseId={caseId} />
        {children}
      </div>
    </CasePageTemplate>
  );
}
