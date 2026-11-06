'use client';

import { type ReactNode } from 'react';
import clsx from 'clsx';

type HighlightBarProps = {
  icon: ReactNode;
  orientation?: 'left' | 'right';
  children: ReactNode;
  className?: string;
};

export default function HighlightBar({
  icon,
  orientation = 'left',
  children,
  className,
}: HighlightBarProps) {
  const iconNode = (
    <div
      aria-hidden="true"
      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
    >
      {icon}
    </div>
  );

  return (
    <div
      className={clsx(
        'flex w-full items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800',
        orientation === 'right' ? 'flex-row-reverse' : 'flex-row',
        className,
      )}
    >
      {iconNode}
      <div
        className={clsx(
          'min-w-0 flex-1 text-sm leading-6 text-gray-700 dark:text-gray-200',
          orientation === 'right' ? 'text-left' : 'text-right',
        )}
      >
        {children}
      </div>
    </div>
  );
}
