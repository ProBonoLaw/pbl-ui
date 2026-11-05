import { logger } from '@/lib/logger';
import { RequestContentFile, SharePointFile } from '@/lib/types';
import { type ReactNode, useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ProxiedIFrame from './ProxiedIFrame';

const MARKDOWN_CONTENT_CLASS =
  'prose max-w-none mt-4 rounded bg-white p-3 text-sm text-slate-900 dark:bg-slate-900/70 dark:text-slate-100 [&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_blockquote]:border-slate-300 dark:[&_blockquote]:border-slate-600 [&_blockquote]:text-slate-700 dark:[&_blockquote]:text-slate-300 [&_h1]:text-slate-950 dark:[&_h1]:text-white [&_h2]:text-slate-950 dark:[&_h2]:text-white [&_h3]:text-slate-950 dark:[&_h3]:text-white [&_li]:text-slate-700 dark:[&_li]:text-slate-200 [&_p]:text-slate-700 dark:[&_p]:text-slate-200 [&_strong]:text-slate-900 dark:[&_strong]:text-white';

export default function ExhibitViewer({
  exhibit,
  fileInfo,
  caseId,
  baseHost,
  viewerUrl,
  markdownContent,
  metadataContent,
  tags,
  collapsible = false,
  defaultOpenDesktop = true,
}: {
  exhibit: RequestContentFile;
  fileInfo?: SharePointFile;
  caseId: string;
  baseHost?: string;
  viewerUrl?: string | null;
  markdownContent?: string;
  metadataContent?: ReactNode;
  tags?: string[];
  collapsible?: boolean;
  defaultOpenDesktop?: boolean;
}) {
  const [viewerOpen, setViewerOpen] = useState<boolean>(false);
  const [url, setUrl] = useState<string | null>(null);
  const canPreview = Boolean((fileInfo && baseHost) || viewerUrl);
  const titleContent = (
    <span className="flex min-w-0 max-w-full items-center gap-2 overflow-hidden">
      <span className="min-w-0 flex-1 truncate">{exhibit.name}</span>
      {tags?.map((tag) => (
        <span
          key={tag}
          className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {tag}
        </span>
      ))}
    </span>
  );

  useEffect(() => {
    if (viewerOpen === false || !caseId) {
      return;
    }

    if (fileInfo && baseHost) {
      logger.info('Requesting embed URL for file:', fileInfo.ServerRelativeUrl);
      setUrl(fileInfo.ServerRelativeUrl!);
      return;
    }

    if (viewerUrl) {
      logger.info('Requesting embed URL for source:', viewerUrl);
      setUrl(viewerUrl);
    }
  }, [caseId, exhibit.name, fileInfo, baseHost, viewerOpen, viewerUrl]);

  const renderBody = (showPreviewToggle = true) => (
    <>
      {showPreviewToggle && canPreview && (
        <button
          onClick={() => {
            setViewerOpen((viewerOpen) => !viewerOpen);
          }}
          className="rounded bg-blue-700 px-3 py-1 text-white hover:bg-blue-800 hover:text-gray-100 dark:bg-blue-600 dark:hover:bg-blue-500">
          {viewerOpen ? 'Hide Preview' : 'Show Preview'}
        </button>
      )}
      {canPreview && url ? (
        <div hidden={!viewerOpen}>
          <ProxiedIFrame src={url} caseId={caseId} />
        </div>
      ) : null}
      <hr className="mt-4 border-slate-200 dark:border-slate-700" />
      {metadataContent && (
        <div className="mt-4 rounded bg-white p-3 text-sm text-slate-900 dark:bg-slate-900/70 dark:text-slate-100">
          {metadataContent}
        </div>
      )}
      {markdownContent && (
        <div className={MARKDOWN_CONTENT_CLASS}>
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              hr({ ...rest }) {
                return (
                  <hr
                    className="my-6 border-0 border-t border-dotted border-slate-300 dark:border-slate-600"
                    {...rest}
                  />
                );
              },
              p({ children, ...rest }) {
                const text = Array.isArray(children)
                  ? children.join('')
                  : typeof children === 'string'
                    ? children
                    : null;
                const pageNumber = text?.match(
                  /^\[\[PAGE_NUMBER:(.+)\]\]$/,
                )?.[1];
                if (pageNumber) {
                  return (
                    <div className="my-4 text-center text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {pageNumber}
                    </div>
                  );
                }

                const pageFooter = text?.match(
                  /^\[\[PAGE_FOOTER:(.+)\]\]$/,
                )?.[1];
                if (pageFooter) {
                  return (
                    <div className="my-4 text-center text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {pageFooter}
                    </div>
                  );
                }

                return <p {...rest}>{children}</p>;
              },
              table({ children, ...rest }) {
                return (
                  <div className="my-4 overflow-x-auto">
                    <table
                      className="min-w-full border-collapse border border-slate-300 text-left text-sm text-slate-900 dark:border-slate-600 dark:text-slate-100"
                      {...rest}>
                      {children}
                    </table>
                  </div>
                );
              },
              thead({ children, ...rest }) {
                return (
                  <thead className="bg-slate-100 dark:bg-slate-800" {...rest}>
                    {children}
                  </thead>
                );
              },
              th({ children, ...rest }) {
                return (
                  <th
                    className="border border-slate-300 px-3 py-2 align-top font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-100"
                    {...rest}>
                    {children}
                  </th>
                );
              },
              td({ children, ...rest }) {
                return (
                  <td
                    className="border border-slate-300 px-3 py-2 align-top text-slate-800 dark:border-slate-600 dark:text-slate-100"
                    {...rest}>
                    {children}
                  </td>
                );
              },
            }}>
            {markdownContent}
          </Markdown>
        </div>
      )}
      <div className="mt-4">
        <div className="font-semibold text-slate-900 dark:text-slate-100">
          Original Source Material
        </div>
        {!exhibit.pages && !exhibit.sourceUrl && (
          <div className="ml-4 text-slate-700 dark:text-slate-300">
            No additional information available.
          </div>
        )}
        {exhibit.pages && (
          <div className="mb-2 ml-4 text-slate-700 dark:text-slate-300">
            Pages: {exhibit.pages}
          </div>
        )}
        {exhibit.sourceUrl && (
          <a
            className="mt-4 mb-2 ml-4 rounded bg-blue-700 px-2 py-1 text-white hover:bg-blue-800 hover:text-gray-100 dark:bg-blue-600 dark:hover:bg-blue-500"
            href={exhibit.sourceUrl}
            target="_blank"
            rel="noopener noreferrer">
            Review Original
          </a>
        )}
      </div>
    </>
  );

  if (!collapsible) {
    return (
      <div className="my-2 border border-slate-200 p-4 text-slate-900 dark:border-slate-700 dark:text-slate-100">
        {canPreview ? (
          <button
            onClick={() => {
              setViewerOpen((viewerOpen) => !viewerOpen);
            }}
            className="max-w-full text-left text-xl hover:underline">
            {titleContent}
          </button>
        ) : (
          <h3 className="max-w-full overflow-hidden text-xl font-semibold">
            {titleContent}
          </h3>
        )}
        {renderBody(false)}
      </div>
    );
  }

  return (
    <>
      <details className="my-2 border border-slate-200 p-4 text-slate-900 dark:border-slate-700 dark:text-slate-100 md:hidden">
        <summary className="max-w-full cursor-pointer overflow-hidden text-xl font-semibold">
          {titleContent}
        </summary>
        <div className="mt-4">{renderBody()}</div>
      </details>
      <details
        className="my-2 hidden border border-slate-200 p-4 text-slate-900 dark:border-slate-700 dark:text-slate-100 md:block"
        open={defaultOpenDesktop}>
        <summary className="max-w-full cursor-pointer overflow-hidden text-xl font-semibold">
          {titleContent}
        </summary>
        <div className="mt-4">{renderBody()}</div>
      </details>
    </>
  );
}
