import InvestigativeTimelinePage from '@/components/timeline/InvestigativeTimelinePage';

export default async function InvestigativeTimelineResultRoute({
  params,
}: Readonly<{
  params: Promise<{ case: string; requestId: string }>;
}>) {
  const { requestId } = await params;
  return <InvestigativeTimelinePage params={params} requestId={requestId} />;
}
