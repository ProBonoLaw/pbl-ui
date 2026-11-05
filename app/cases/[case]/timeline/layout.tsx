import TimelineShell from '@/components/timeline/TimelineShell';

export default function TimelineLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ case: string }>;
}>) {
  return <TimelineShell params={params}>{children}</TimelineShell>;
}
