import RealtimeTimelinePage from '@/components/timeline/RealtimeTimelinePage';
import { redirect } from 'next/navigation';

export default async function RealtimeTimelineRoute({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ case: string }>;
  searchParams: Promise<{ requestId?: string | string[] }>;
}>) {
  const { requestId } = await searchParams;
  if (requestId !== undefined) {
    const { case: caseId } = await params;
    redirect(`/cases/${caseId}/timeline/realtime`);
  }

  return <RealtimeTimelinePage params={params} />;
}
