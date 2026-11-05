'use client';

import * as React from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

export type AccordionItem = {
  id: string;
  title: React.ReactNode;
  content: React.ReactNode;
};

const TAILWIND_BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

type TailwindBreakpoint = keyof typeof TAILWIND_BREAKPOINTS;

function useMediaQuery(query: string) {
  const [mounted, setMounted] = React.useState(false);
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, [query]);

  // SSR-safe: default false until mounted
  return mounted ? matches : false;
}

export function ResponsiveAccordion({
  items,
  maxWidthPx,
  breakpoint = 'md',
  defaultOpenId,
  orientation = 'horizontal',
}: {
  items: AccordionItem[];
  maxWidthPx?: number;
  breakpoint?: TailwindBreakpoint;
  defaultOpenId?: string;
  orientation?: 'horizontal' | 'vertical';
}) {
  const maxWidth =
    typeof maxWidthPx === 'number'
      ? maxWidthPx
      : TAILWIND_BREAKPOINTS[breakpoint] - 1;
  const isMobile = useMediaQuery(`(max-width: ${maxWidth}px)`);
  const [openId, setOpenId] = React.useState<string | null>(
    defaultOpenId ?? null,
  );

  // Desktop: show everything expanded, non-collapsible.
  if (!isMobile) {
    const overallClassname =
      orientation === 'horizontal' ? 'flex flex-row' : 'flex flex-col';
    const itemClassname = orientation === 'horizontal' ? 'mx-4 flex-1' : 'my-2';
    return (
      <div
        className={overallClassname}
        role="region"
        aria-label="Content sections">
        {items.map((item) => (
          <section key={item.id} className={itemClassname}>
            <h3 className="text-base font-semibold">{item.title}</h3>
            <div className="text-base">{item.content}</div>
          </section>
        ))}
      </div>
    );
  }

  // Mobile: collapsible accordion.
  return (
    <div role="region" aria-label="Mobile accordion">
      {items.map((item) => {
        const isOpen = openId === item.id;
        const btnId = `acc-btn-${item.id}`;
        const panelId = `acc-panel-${item.id}`;

        return (
          <div
            key={item.id}
            className="mb-2 overflow-hidden rounded-xl border border-black/10">
            <button
              id={btnId}
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenId(isOpen ? null : item.id)}
              className="flex w-full items-center justify-between px-2 py-1.5 text-left text-base font-semibold">
              <span>{item.title}</span>
              <ChevronDownIcon
                aria-hidden
                className={`size-5 transition-transform ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            <div
              id={panelId}
              role="region"
              aria-labelledby={btnId}
              className={isOpen ? 'px-4 pb-3' : 'hidden'}>
              {item.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
