import InvestigativeTimelinePage from '@/components/timeline/InvestigativeTimelinePage';

export default function InvestigativeTimelineRoute({
  params,
}: Readonly<{
  params: Promise<{ case: string }>;
}>) {
  return <InvestigativeTimelinePage params={params} />;
}
