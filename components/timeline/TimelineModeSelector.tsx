'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type TimelineBuildMode = 'realtime' | 'investigative';

const modes = [
  {
    id: 'realtime',
    title: 'Realtime',
    description: 'Generate results immediately with AIMIE.',
  },
  {
    id: 'investigative',
    title: 'Investigative',
    description: 'Queue a deeper review and receive a notification.',
  },
] as const;

export default function TimelineModeSelector({
  caseId,
}: Readonly<{
  caseId: string;
}>) {
  const pathname = usePathname();
  const mode: TimelineBuildMode = pathname.includes('/timeline/investigative')
    ? 'investigative'
    : 'realtime';

  return (
    <nav aria-label="Timeline build mode">
      <p className="text-sm font-semibold">Build mode</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {modes.map((option) => (
          <Link
            key={option.id}
            href={`/cases/${caseId}/timeline/${option.id}`}
            className={`cursor-pointer rounded-lg border p-4 transition-colors ${
              mode === option.id
                ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-500/10'
                : 'border-gray-200 hover:border-gray-300 dark:border-white/10 dark:hover:border-white/30'
            }`}
            aria-current={mode === option.id ? 'page' : undefined}>
            <span className="block font-medium">{option.title}</span>
            <span className="mt-1 block text-sm text-gray-600 dark:text-gray-300">
              {option.description}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
