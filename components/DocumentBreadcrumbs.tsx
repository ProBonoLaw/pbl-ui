import Link from 'next/link';

function decodeSegmentForDisplay(segment: string): string {
  try {
    return decodeURIComponent(segment.replace(/\+/g, ' '));
  } catch {
    return segment;
  }
}

export default function DocumentBreadcrumbs({ path }: { path: string[] }) {
  return (
    <div className="m-2 p-4">
      <nav
        aria-label="Breadcrumb"
        className="flex border-b border-gray-200 bg-white dark:border-white/10 dark:bg-gray-800/50">
        <ol
          role="list"
          className="mx-auto flex w-full max-w-(--breakpoint-xl) space-x-4 px-4 sm:px-6 lg:px-8">
          <li className="flex">
            <div className="flex items-center">
              <svg
                fill="currentColor"
                viewBox="0 0 24 44"
                preserveAspectRatio="none"
                aria-hidden="true"
                className="h-full w-6 shrink-0 text-gray-200 dark:text-white/10">
                <path d="M.293 0l22 22-22 22h1.414l22-22-22-22H.293z" />
              </svg>
            </div>
          </li>
          {path.map((segment, index) => {
            const displaySegment = decodeSegmentForDisplay(segment);

            return (
              <li key={index} className="flex">
                <div className="flex items-center">
                  {index > 1 ? (
                    <Link
                      aria-current={
                        index === path.length - 1 ? 'page' : undefined
                      }
                      className="ml-4 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      href={`/${path.slice(0, index + 1).join('/')}`}>
                      {displaySegment}
                    </Link>
                  ) : null}
                  {index < path.length - 1 && index > 1 && (
                    <svg
                      fill="currentColor"
                      viewBox="0 0 24 44"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                      className="h-full w-6 shrink-0 text-gray-200 dark:text-white/10">
                      <path d="M.293 0l22 22-22 22h1.414l22-22-22-22H.293z" />
                    </svg>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
