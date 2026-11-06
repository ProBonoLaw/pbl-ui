'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid';

type PaginationToken = number | 'ellipsis';

type PaginationProps = Readonly<{
  currentPage: number;
  disabled?: boolean;
  hasNextPage: boolean;
  itemCount: number;
  maxPage?: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalItems: number | null;
}>;

function getPageTokens(currentPage: number, totalPages: number): PaginationToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      'ellipsis',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    'ellipsis',
    currentPage - 1,
    currentPage,
    currentPage + 1,
    'ellipsis',
    totalPages,
  ];
}

export default function Pagination({
  currentPage,
  disabled = false,
  hasNextPage,
  itemCount,
  maxPage,
  onPageChange,
  pageSize,
  totalItems,
}: PaginationProps) {
  const startItem = itemCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = itemCount === 0 ? 0 : (currentPage - 1) * pageSize + itemCount;
  const totalPages = totalItems === null
    ? null
    : Math.min(Math.ceil(totalItems / pageSize), maxPage ?? Infinity);
  const canGoNext = hasNextPage && currentPage < (maxPage ?? Infinity);
  const pageTokens =
    totalPages === null ? [currentPage] : getPageTokens(currentPage, totalPages);
  const canGoPrevious = currentPage > 1;
  const showNavigation = canGoPrevious || canGoNext || (totalPages ?? 0) > 1;

  const range = (
    <p className="text-sm text-gray-700 dark:text-gray-300">
      Showing <span className="font-medium">{startItem}</span> to{' '}
      <span className="font-medium">{endItem}</span>
      {totalItems === null ? (
        ' results'
      ) : (
        <>
          {' of '}<span className="font-medium">{totalItems}</span> results
        </>
      )}
    </p>
  );

  const previousButton = (
    <button
      type="button"
      aria-label="Previous page"
      disabled={disabled || !canGoPrevious}
      onClick={() => onPageChange(currentPage - 1)}
      className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10">
      <ChevronLeftIcon aria-hidden="true" className="size-5 sm:hidden" />
      <span className="sm:hidden">Previous</span>
      <span className="sr-only sm:not-sr-only">Previous</span>
    </button>
  );

  const nextButton = (
    <button
      type="button"
      aria-label="Next page"
      disabled={disabled || !canGoNext}
      onClick={() => onPageChange(currentPage + 1)}
      className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10">
      <span className="sm:hidden">Next</span>
      <span className="sr-only sm:not-sr-only">Next</span>
      <ChevronRightIcon aria-hidden="true" className="size-5 sm:hidden" />
    </button>
  );

  if (!showNavigation) {
    return <div className="border-t border-gray-200 py-3 dark:border-white/10">{range}</div>;
  }

  return (
    <div className="flex items-center justify-between border-t border-gray-200 bg-white py-3 dark:border-white/10 dark:bg-transparent sm:px-2">
      <div className="hidden sm:block">{range}</div>
      <div className="flex flex-1 justify-between sm:hidden">
        {previousButton}
        {nextButton}
      </div>
      <nav aria-label="Pagination" className="hidden sm:block">
        <div className="isolate inline-flex -space-x-px rounded-md shadow-xs dark:shadow-none">
          <button
            type="button"
            aria-label="Previous page"
            disabled={disabled || !canGoPrevious}
            onClick={() => onPageChange(currentPage - 1)}
            className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-500 inset-ring inset-ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 focus:z-20 focus:outline-offset-0 dark:inset-ring-gray-700 dark:hover:bg-white/5">
            <ChevronLeftIcon aria-hidden="true" className="size-5" />
          </button>
          {pageTokens.map((token, index) =>
            token === 'ellipsis' ? (
              <span
                key={`ellipsis-${index}`}
                aria-hidden="true"
                className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 inset-ring inset-ring-gray-300 dark:text-gray-400 dark:inset-ring-gray-700">
                …
              </span>
            ) : (
              <button
                key={token}
                type="button"
                aria-current={token === currentPage ? 'page' : undefined}
                aria-label={`Page ${token}`}
                disabled={disabled}
                onClick={() => onPageChange(token)}
                className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 focus:outline-offset-0 ${
                  token === currentPage
                    ? 'z-10 bg-indigo-600 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:focus-visible:outline-indigo-500'
                    : 'text-gray-900 inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:text-gray-200 dark:inset-ring-gray-700 dark:hover:bg-white/5'
                }`}>
                {token}
              </button>
            ),
          )}
          <button
            type="button"
            aria-label="Next page"
            disabled={disabled || !canGoNext}
            onClick={() => onPageChange(currentPage + 1)}
            className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-500 inset-ring inset-ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 focus:z-20 focus:outline-offset-0 dark:inset-ring-gray-700 dark:hover:bg-white/5">
            <ChevronRightIcon aria-hidden="true" className="size-5" />
          </button>
        </div>
      </nav>
    </div>
  );
}
