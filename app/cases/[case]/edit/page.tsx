import { redirect } from 'next/navigation';

export default async function EditCaseRedirect({
  params,
}: Readonly<{
  params: Promise<{ case: string }>;
}>) {
  const { case: caseId } = await params;
  redirect(`/cases/${encodeURIComponent(caseId)}`);
}
