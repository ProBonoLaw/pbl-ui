'use client';

import { useEffect, useState } from 'react';

export default function TimelineAccordion({
  title,
  description,
  children,
  defaultOpen = false,
  collapseWhen = false,
}: Readonly<{
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  collapseWhen?: boolean;
}>) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    setIsOpen(!collapseWhen);
  }, [collapseWhen]);

  return (
    <details
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
      <summary className="cursor-pointer px-5 py-4 hover:bg-gray-50 dark:hover:bg-white/5">
        <span className="block font-semibold">{title}</span>
        {description && (
          <span className="mt-1 block text-sm text-gray-600 dark:text-gray-300">
            {description}
          </span>
        )}
      </summary>
      <div className="border-t border-gray-200 p-5 dark:border-white/10">
        {children}
      </div>
    </details>
  );
}
