'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import DocumentBreadcrumbs from './DocumentBreadcrumbs';
import LoadingState from './LoadingState';
import { cn } from '@/lib/cssHelper';

export default function PageTemplate({
  title,
  currentPath = undefined,
  isLoading = undefined,
  children,
  actionSection,
  className,
  maxWidthClassName = 'max-w-[100rem]',
  fixedHeader = false,
  headerContentClassName,
  showBreadcrumbs = false,
  contentScrollable = true,
}: Readonly<{
  title: string | React.ReactNode;
  currentPath?: string[];
  isLoading?: boolean;
  children: React.ReactNode;
  actionSection?: React.ReactNode;
  className?: string;
  maxWidthClassName?: string;
  fixedHeader?: boolean;
  headerContentClassName?: string;
  showBreadcrumbs?: boolean;
  contentScrollable?: boolean;
}>) {
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const combinedClassName = cn(
    'mx-auto flex h-[calc(100dvh-4rem-env(safe-area-inset-top))] min-h-0 w-full flex-col overflow-hidden pb-4 sm:h-[calc(100dvh-4rem-1px)]',
    maxWidthClassName,
    className,
  );

  useLayoutEffect(() => {
    if (!fixedHeader || !headerRef.current) {
      return;
    }

    const updateHeight = () => {
      setHeaderHeight(
        Math.ceil(headerRef.current?.getBoundingClientRect().height ?? 0),
      );
    };
    const observer = new ResizeObserver(updateHeight);
    observer.observe(headerRef.current);
    updateHeight();

    return () => observer.disconnect();
  }, [fixedHeader]);

  const headerSpacerStyle =
    headerHeight > 0 ? { height: `calc(8px + ${headerHeight}px)` } : undefined;
  return (
    <div className={combinedClassName}>
      <main className="flex min-h-0 flex-1 flex-col">
        {fixedHeader && (
          <div
            aria-hidden="true"
            className="hidden sm:block sm:h-40"
            style={headerSpacerStyle}
          />
        )}
        <div
          className={cn(
            'relative z-3 w-full shrink-0 bg-background pb-2 sm:mt-5 sm:pt-4',
            fixedHeader &&
            'sm:!fixed sm:!top-16 sm:left-1/2 sm:z-3 sm:w-full sm:-translate-x-1/2 sm:mt-0 sm:mr-0 sm:ml-0 sm:pb-0 sm:pt-0',
            fixedHeader && maxWidthClassName,
          )}>
          <div
            ref={headerRef}
            className={cn(
              headerContentClassName,
              fixedHeader &&
              'w-full sm:min-h-36 sm:w-auto sm:bg-background sm:pb-2 sm:pt-4',
            )}>
            <div className="sm:mb-6">
              {typeof title === 'string' ? (
                <h1 className="mt-2 px-4 text-lg font-semibold sm:mt-0 sm:px-6 sm:text-3xl sm:font-bold">
                  {title}
                </h1>
              ) : (
                <div className="px-4 sm:px-6">{title}</div>
              )}
              {showBreadcrumbs && currentPath && <DocumentBreadcrumbs path={currentPath} />}
            </div>
            <div
              className={cn(
                'w-full px-4 sm:px-6',
                fixedHeader && 'sm:w-auto sm:min-w-0 sm:max-w-none',
              )}>
              {actionSection}
            </div>
          </div>
        </div>
        <div
          data-slot="page-content"
          role="region"
          aria-label="Page content"
          tabIndex={0}
          className={cn(
            'min-h-0 w-full flex-1 overscroll-contain px-4 pt-4 sm:px-6',
            contentScrollable ? 'overflow-y-auto' : 'overflow-hidden',
          )}>
          {isLoading ? <LoadingState fullHeight /> : children}
        </div>
      </main>
    </div>
  );
}
