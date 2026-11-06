import { redirect } from 'next/navigation';

export default async function TimelineIndexPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ case: string }>;
  searchParams: Promise<{ requestId?: string | string[] }>;
}>) {
  const [{ case: caseId }, { requestId }] = await Promise.all([
    params,
    searchParams,
  ]);
  const normalizedRequestId = (
    Array.isArray(requestId) ? requestId[0] : requestId
  )?.trim();

  if (normalizedRequestId) {
    redirect(
      `/cases/${caseId}/timeline/investigative/${encodeURIComponent(normalizedRequestId)}`,
    );
  }

  redirect(`/cases/${caseId}/timeline/realtime`);
}
