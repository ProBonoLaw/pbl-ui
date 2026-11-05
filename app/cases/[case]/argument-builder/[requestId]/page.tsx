'use client';

import CasePageTemplate from '@/components/cases/CasePageTemplate';
import DocumentTemporalMetadataDate, {
  formatDocumentTemporalMetadata,
} from '@/components/DocumentTemporalMetadataDate';
import ExhibitViewer from '@/components/ExhibitViewer';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';
import {
  ArgumentBuilderOutput,
  DocumentTemporalMetadata,
  ArgumentBuilderValidation,
  parseArgumentBuilderOutput,
  parseRequestData,
  RequestContentFile,
  RequestData,
} from '@/lib/types';
import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AiOutputNotice from '@/components/AiOutputNotice';

type TemporalMetadata = DocumentTemporalMetadata;

type StructuredEvidenceMetadata = {
  tags: string[];
  who?: string | null;
  what?: string | null;
  where?: string | null;
  why?: string | null;
  whenStarted?: TemporalMetadata | null;
  whenEnded?: TemporalMetadata | null;
};

type StructuredMetadataTextSource = string | string[] | null | undefined;

type StructuredMetadataSource = {
  tags?: string[] | null;
  who?: StructuredMetadataTextSource;
  what?: StructuredMetadataTextSource;
  where?: StructuredMetadataTextSource;
  why?: StructuredMetadataTextSource;
  whenStarted?: TemporalMetadata | null;
  whenEnded?: TemporalMetadata | null;
};

type EvidenceEntry = {
  docId: string;
  order: number;
  title?: string;
  sourceUrl?: string;
  headers: string[];
  pages: (string | number)[];
  snippets: string[];
  metadata: StructuredEvidenceMetadata;
  firstIndex?: number;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeStructuredMetadataText(
  value: StructuredMetadataTextSource,
): string | null {
  if (isNonEmptyString(value)) {
    return value.trim();
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const values = value
    .filter(isNonEmptyString)
    .map((entry) => entry.trim())
    .filter((entry, index, entries) => entries.indexOf(entry) === index);

  return values.length > 0 ? values.join(', ') : null;
}

function appendUnique<T>(target: T[], values: T[] | undefined) {
  values?.forEach((value) => {
    if (!target.includes(value)) {
      target.push(value);
    }
  });
}

const STRUCTURED_METADATA_TAG_MARKERS = ['fact', 'event', 'claim'];

function hasStructuredMetadataTag(tags: string[] | null | undefined) {
  return (
    tags?.some((tag) => {
      const normalizedTag = tag.toLowerCase();
      return STRUCTURED_METADATA_TAG_MARKERS.some((marker) =>
        normalizedTag.includes(marker),
      );
    }) ?? false
  );
}

function mergeStructuredMetadata(
  entry: EvidenceEntry,
  source: StructuredMetadataSource,
) {
  appendUnique(entry.metadata.tags, source.tags ?? undefined);
  const who = normalizeStructuredMetadataText(source.who);
  const what = normalizeStructuredMetadataText(source.what);
  const where = normalizeStructuredMetadataText(source.where);
  const why = normalizeStructuredMetadataText(source.why);

  if (!entry.metadata.who && who) {
    entry.metadata.who = who;
  }
  if (!entry.metadata.what && what) {
    entry.metadata.what = what;
  }
  if (!entry.metadata.where && where) {
    entry.metadata.where = where;
  }
  if (!entry.metadata.why && why) {
    entry.metadata.why = why;
  }
  if (!entry.metadata.whenStarted && source.whenStarted) {
    entry.metadata.whenStarted = source.whenStarted;
  }
  if (!entry.metadata.whenEnded && source.whenEnded) {
    entry.metadata.whenEnded = source.whenEnded;
  }
}

function getSourceUrl(...values: (string | undefined)[]) {
  return values.find((value) => {
    if (!value) {
      return false;
    }
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  });
}

function decodePath(path: string) {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

function getPreviewableSourceUrl(
  sourceUrl: string | undefined,
  caseId: string,
) {
  if (!sourceUrl) {
    return null;
  }

  const expectedPrefix = `/sites/${caseId}/Shared Documents/`;
  const decodedSourceUrl = decodePath(sourceUrl);
  if (decodedSourceUrl.startsWith(expectedPrefix)) {
    return decodedSourceUrl;
  }

  try {
    const url = new URL(sourceUrl);
    const decodedPathname = decodePath(url.pathname);
    return decodedPathname.startsWith(expectedPrefix) ? decodedPathname : null;
  } catch {
    return null;
  }
}

function stripDuplicateHeading(content: string, title: string) {
  const trimmed = content.trimStart();
  const firstLineEnd = trimmed.indexOf('\n');
  const firstLine =
    firstLineEnd === -1 ? trimmed : trimmed.slice(0, firstLineEnd);
  const headingText = firstLine
    .replace(/^#{1,6}\s+/, '')
    .replaceAll('*', '')
    .replace(/:$/, '')
    .trim();

  if (headingText.toLowerCase() !== title.toLowerCase()) {
    return trimmed;
  }

  return firstLineEnd === -1 ? '' : trimmed.slice(firstLineEnd + 1).trimStart();
}

function formatDate(value: string | undefined) {
  if (!value) {
    return 'Not available';
  }
  return new Date(value).toLocaleString('en-US');
}

function formatPages(pages: (string | number)[] | undefined) {
  return pages && pages.length > 0 ? pages.join(', ') : null;
}

function buildEvidenceEntries(output: ArgumentBuilderOutput) {
  const entries = new Map<string, EvidenceEntry>();
  let order = 0;

  const getEntry = (docId: string) => {
    let entry = entries.get(docId);
    if (!entry) {
      entry = {
        docId,
        order: order++,
        headers: [],
        pages: [],
        snippets: [],
        metadata: { tags: [] },
      };
      entries.set(docId, entry);
    }
    return entry;
  };

  output.context?.forEach((reference) => {
    const entry = getEntry(reference.docId);
    if (
      !entry.title &&
      reference.title &&
      reference.title !== reference.docId
    ) {
      entry.title = reference.title;
    }
    entry.sourceUrl = getSourceUrl(entry.sourceUrl, reference.sourceUrl);
    appendUnique(entry.headers, reference.headers);
    appendUnique(entry.pages, reference.pages);
    mergeStructuredMetadata(entry, reference);
    if (
      !hasStructuredMetadataTag(reference.tags) &&
      isNonEmptyString(reference.pageContent) &&
      !entry.snippets.includes(reference.pageContent)
    ) {
      entry.snippets.push(reference.pageContent);
    }
  });

  output.exhibits?.forEach((exhibit) => {
    const entry = getEntry(exhibit.doc.docId);
    entry.firstIndex = exhibit.firstIndex;
    entry.sourceUrl = getSourceUrl(entry.sourceUrl, exhibit.doc.sourceUrl);
    appendUnique(entry.pages, exhibit.doc.pages);
    mergeStructuredMetadata(entry, exhibit.doc);
    if ('headers' in exhibit.doc) {
      appendUnique(entry.headers, exhibit.doc.headers);
    }
    if (
      !hasStructuredMetadataTag(exhibit.doc.tags) &&
      'pageContent' in exhibit.doc &&
      isNonEmptyString(exhibit.doc.pageContent) &&
      !entry.snippets.includes(exhibit.doc.pageContent)
    ) {
      entry.snippets.push(exhibit.doc.pageContent);
    }
  });

  return Array.from(entries.values()).sort((a, b) => {
    if (a.firstIndex !== undefined && b.firstIndex !== undefined) {
      return a.firstIndex - b.firstIndex;
    }
    if (a.firstIndex !== undefined) {
      return -1;
    }
    if (b.firstIndex !== undefined) {
      return 1;
    }
    return a.order - b.order;
  });
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_entity, codePoint: string) =>
      String.fromCodePoint(Number(codePoint)),
    );
}

function cleanHtmlTableCell(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?\s*>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  ).replace(/\|/g, '\\|');
}

function cleanHtmlBlockContent(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/(p|div|figcaption|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n'),
  );
}

function convertHtmlFiguresToMarkdown(content: string) {
  return content.replace(
    /<figure\b[^>]*>([\s\S]*?)<\/figure>/gi,
    (_figure, figureBody: string) => {
      const cleaned = cleanHtmlBlockContent(figureBody);
      if (!cleaned) {
        return '';
      }

      const quoted = cleaned
        .split('\n')
        .map((line) => '> ' + line)
        .join('\n');

      return '\n\n' + quoted + '\n\n';
    },
  );
}

function convertHtmlTablesToMarkdown(content: string) {
  return content.replace(
    /<table\b[^>]*>([\s\S]*?)<\/table>/gi,
    (_table, tableBody: string) => {
      const rows = Array.from(
        tableBody.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi),
      )
        .map((rowMatch) =>
          Array.from(
            rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi),
          ).map((cellMatch) => cleanHtmlTableCell(cellMatch[1])),
        )
        .filter((row) => row.length > 0);

      if (rows.length === 0) {
        return '';
      }

      const columnCount = Math.max(...rows.map((row) => row.length));
      const normalizedRows = rows.map((row) => [
        ...row,
        ...Array.from({ length: columnCount - row.length }, () => ''),
      ]);
      const header = Array.from({ length: columnCount }, () => ' ');
      const separator = Array.from({ length: columnCount }, () => '---');
      const formatRow = (row: string[]) => `| ${row.join(' | ')} |`;

      return [
        '',
        formatRow(header),
        formatRow(separator),
        ...normalizedRows.map(formatRow),
        '',
      ].join('\n');
    },
  );
}

function formatPageContentMarkdown(content: string) {
  return convertHtmlFiguresToMarkdown(convertHtmlTablesToMarkdown(content))
    .replace(/\n?<!--\s*PageBreak\s*-->\n?/gi, '\n\n---\n\n')
    .replace(
      /\n?<!--\s*PageNumber="?([^"-]+)"?\s*-->\n?/gi,
      (_match, pageNumber: string) =>
        `\n\n[[PAGE_NUMBER:${pageNumber.trim()}]]\n\n`,
    )
    .replace(
      /\n?<!--\s*PageFooter="?([^"]+)"?\s*-->\n?/gi,
      (_match, pageFooter: string) =>
        `\n\n[[PAGE_FOOTER:${pageFooter.trim()}]]\n\n`,
    );
}

function formatMetadataValue(value: string | null | undefined) {
  return isNonEmptyString(value) ? value.trim() : 'Not available';
}

const PANEL_CLASS =
  'rounded-md border border-slate-200 bg-white p-4 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100';
const SUBTLE_PANEL_CLASS =
  'rounded-md border border-slate-200 bg-slate-50 p-4 text-slate-900 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100';
const MARKDOWN_CONTENT_CLASS =
  'prose max-w-none text-slate-900 dark:text-slate-100 [&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_blockquote]:border-slate-300 dark:[&_blockquote]:border-slate-600 [&_blockquote]:text-slate-700 dark:[&_blockquote]:text-slate-300 [&_h1]:text-slate-950 dark:[&_h1]:text-white [&_h2]:text-slate-950 dark:[&_h2]:text-white [&_h3]:text-slate-950 dark:[&_h3]:text-white [&_li]:text-slate-700 dark:[&_li]:text-slate-200 [&_p]:text-slate-700 dark:[&_p]:text-slate-200 [&_strong]:text-slate-900 dark:[&_strong]:text-white';
const METADATA_HEADER_CLASS =
  'w-40 border border-slate-300 bg-slate-100 px-3 py-2 align-top font-semibold text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';
const METADATA_SUBHEADER_CLASS =
  'w-28 border border-slate-300 bg-slate-50 px-3 py-2 align-top font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-200';
const METADATA_CELL_CLASS =
  'border border-slate-300 px-3 py-2 align-top text-slate-800 dark:border-slate-600 dark:text-slate-100';

function StructuredEvidenceMetadataTable({
  metadata,
}: {
  metadata: StructuredEvidenceMetadata;
}) {
  const hasStarted = Boolean(
    formatDocumentTemporalMetadata(metadata.whenStarted),
  );
  const hasEnded = Boolean(formatDocumentTemporalMetadata(metadata.whenEnded));
  const hasStartedAndEnded = hasStarted && hasEnded;

  return (
    <table className="min-w-full border-collapse border border-slate-300 text-left text-sm text-slate-900 dark:border-slate-600 dark:text-slate-100">
      <tbody>
        <tr>
          <th className={METADATA_HEADER_CLASS}>Who</th>
          <td className={METADATA_CELL_CLASS} colSpan={2}>
            {formatMetadataValue(metadata.who)}
          </td>
        </tr>
        <tr>
          <th className={METADATA_HEADER_CLASS}>What</th>
          <td className={METADATA_CELL_CLASS} colSpan={2}>
            {formatMetadataValue(metadata.what)}
          </td>
        </tr>
        <tr>
          <th className={METADATA_HEADER_CLASS}>Where</th>
          <td className={METADATA_CELL_CLASS} colSpan={2}>
            {formatMetadataValue(metadata.where)}
          </td>
        </tr>
        {hasStartedAndEnded ? (
          <>
            <tr>
              <th className={METADATA_HEADER_CLASS} rowSpan={2}>
                When
              </th>
              <th className={METADATA_SUBHEADER_CLASS}>started</th>
              <td className={METADATA_CELL_CLASS}>
                <DocumentTemporalMetadataDate value={metadata.whenStarted} />
              </td>
            </tr>
            <tr>
              <th className={METADATA_SUBHEADER_CLASS}>ended</th>
              <td className={METADATA_CELL_CLASS}>
                <DocumentTemporalMetadataDate value={metadata.whenEnded} />
              </td>
            </tr>
          </>
        ) : (
          <tr>
            <th className={METADATA_HEADER_CLASS} colSpan={2}>
              When
            </th>
            <td className={METADATA_CELL_CLASS}>
              <DocumentTemporalMetadataDate
                value={hasStarted ? metadata.whenStarted : metadata.whenEnded}
              />
            </td>
          </tr>
        )}
        <tr>
          <th className={METADATA_HEADER_CLASS}>Why</th>
          <td className={METADATA_CELL_CLASS} colSpan={2}>
            {formatMetadataValue(metadata.why)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function getEvidenceLabel(entry: EvidenceEntry, index: number) {
  return entry.firstIndex !== undefined
    ? `Exhibit ${entry.firstIndex}`
    : `Supporting Material ${index + 1}`;
}

function getEvidenceAnchorId(docId: string) {
  return `supporting-material-${docId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function getEvidenceAnchorHref(docId: string) {
  return '#' + getEvidenceAnchorId(docId);
}

function getEvidenceLinkKeys(value: string | undefined) {
  if (!value) {
    return [];
  }

  const keys = new Set<string>();
  const addKey = (key: string | undefined) => {
    const trimmed = key?.trim();
    if (trimmed) {
      keys.add(trimmed.toLowerCase());
    }
  };

  addKey(value);
  const citationMatch = value.trim().match(/^\(?\[?#?([0-9]+)\]?\)?$/);
  if (citationMatch) {
    addKey(citationMatch[1]);
    addKey('#' + citationMatch[1]);
    addKey('[' + citationMatch[1] + ']');
    addKey('exhibit ' + citationMatch[1]);
  }
  try {
    addKey(decodeURIComponent(value));
  } catch {
    // Ignore malformed URL escape sequences.
  }

  try {
    const url = new URL(value, 'https://local.invalid');
    addKey(url.pathname);
    addKey(url.pathname + url.search);
    addKey(url.hash);
    addKey(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
    try {
      addKey(decodeURIComponent(url.pathname));
      addKey(decodeURIComponent(url.pathname + url.search));
    } catch {
      // Ignore malformed URL escape sequences.
    }
  } catch {
    // Ignore values that cannot be URL-parsed.
  }

  return Array.from(keys);
}

function buildEvidenceAnchorTargets(evidence: EvidenceEntry[]) {
  const targets = new Map<string, string>();

  evidence.forEach((entry) => {
    const href = getEvidenceAnchorHref(entry.docId);
    const indexedValues = [entry.docId, entry.sourceUrl];
    if (entry.firstIndex !== undefined) {
      const indexText = String(entry.firstIndex);
      indexedValues.push(
        indexText,
        '#' + indexText,
        '[' + indexText + ']',
        'exhibit ' + indexText,
        'Exhibit ' + indexText,
      );
    }

    indexedValues.forEach((value) => {
      getEvidenceLinkKeys(value).forEach((key) => {
        if (!targets.has(key)) {
          targets.set(key, href);
        }
      });
    });
  });

  return targets;
}

function resolveEvidenceAnchorHref(
  href: string | undefined,
  evidenceAnchorTargets: Map<string, string> | undefined,
) {
  if (!href || !evidenceAnchorTargets) {
    return undefined;
  }
  if (href.startsWith('#supporting-material-')) {
    return href;
  }

  for (const key of getEvidenceLinkKeys(href)) {
    const target = evidenceAnchorTargets.get(key);
    if (target) {
      return target;
    }
  }

  return undefined;
}

function getMarkdownText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(getMarkdownText).join('');
  }
  if (value && typeof value === 'object' && 'props' in value) {
    return getMarkdownText(
      (value as { props?: { children?: unknown } }).props?.children,
    );
  }
  return '';
}

function resolveEvidenceAnchorFromLink(
  href: string | undefined,
  children: unknown,
  evidenceAnchorTargets: Map<string, string> | undefined,
) {
  const textHref = resolveEvidenceAnchorHref(
    getMarkdownText(children),
    evidenceAnchorTargets,
  );
  if (textHref) {
    return textHref;
  }

  return resolveEvidenceAnchorHref(href, evidenceAnchorTargets) ?? href;
}

function MarkdownSection({
  title,
  content,
  collapsible = false,
  duplicateHeadingTitles,
  evidenceAnchorTargets,
}: {
  title: string;
  content?: string;
  collapsible?: boolean;
  duplicateHeadingTitles?: string[];
  evidenceAnchorTargets?: Map<string, string>;
}) {
  if (!content) {
    return null;
  }

  const headingTitles = duplicateHeadingTitles ?? [title];
  const markdown = headingTitles.reduce(
    (currentContent, headingTitle) =>
      stripDuplicateHeading(currentContent, headingTitle),
    content,
  );
  const body = (
    <div className={MARKDOWN_CONTENT_CLASS}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1({ children, ...rest }) {
            return (
              <h1
                className="mt-4 mb-2 text-2xl font-bold text-slate-950 dark:text-white"
                {...rest}>
                {children}
              </h1>
            );
          },
          h2({ children, ...rest }) {
            return (
              <h2
                className="mt-4 mb-2 text-xl font-bold text-slate-950 dark:text-white"
                {...rest}>
                {children}
              </h2>
            );
          },
          h3({ children, ...rest }) {
            return (
              <h3
                className="mt-3 mb-2 text-lg font-bold text-slate-950 dark:text-white"
                {...rest}>
                {children}
              </h3>
            );
          },
          p({ children, ...rest }) {
            return (
              <p
                className="my-3 leading-7 text-slate-700 dark:text-slate-200"
                {...rest}>
                {children}
              </p>
            );
          },
          ul({ children, ...rest }) {
            return (
              <ul
                className="my-3 ml-6 list-disc text-slate-700 dark:text-slate-200"
                {...rest}>
                {children}
              </ul>
            );
          },
          ol({ children, ...rest }) {
            return (
              <ol
                className="my-3 ml-6 list-decimal text-slate-700 dark:text-slate-200"
                {...rest}>
                {children}
              </ol>
            );
          },
          a({ children, href, ...rest }) {
            const anchoredHref = resolveEvidenceAnchorFromLink(
              href,
              children,
              evidenceAnchorTargets,
            );
            const isSamePageAnchor = anchoredHref?.startsWith('#');

            return (
              <a
                href={anchoredHref}
                className="text-blue-600 hover:underline dark:text-blue-400"
                {...rest}
                {...(!isSamePageAnchor
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}>
                {children}
              </a>
            );
          },
        }}>
        {markdown}
      </Markdown>
    </div>
  );

  if (collapsible) {
    return (
      <details className={PANEL_CLASS}>
        <summary className="cursor-pointer text-xl font-bold">{title}</summary>
        <div className="mt-3">{body}</div>
      </details>
    );
  }

  return (
    <section className={PANEL_CLASS}>
      <h2 className="text-xl font-bold mb-3">{title}</h2>
      {body}
    </section>
  );
}

function RequestSummary({ request }: { request: RequestData }) {
  const requestContent = (
    <>
      <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <dt className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Status
          </dt>
          <dd className="capitalize">{request.status}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Started
          </dt>
          <dd>{formatDate(request.startedAt)}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Ended
          </dt>
          <dd>{formatDate(request.endedAt)}</dd>
        </div>
      </dl>
      {request.input && (
        <div className="mt-4">
          <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Input
          </div>
          <p className="mt-1 whitespace-pre-wrap">{request.input}</p>
        </div>
      )}
    </>
  );

  return (
    <>
      <details className={SUBTLE_PANEL_CLASS + ' md:hidden'}>
        <summary className="cursor-pointer text-xl font-bold">
          Request Summary
        </summary>
        <div className="mt-3">{requestContent}</div>
      </details>
      <details className={SUBTLE_PANEL_CLASS + ' hidden md:block'}>
        <summary className="cursor-pointer text-xl font-bold">
          Request Summary
        </summary>
        <div className="mt-3">{requestContent}</div>
      </details>
    </>
  );
}

function EvidenceSection({
  evidence,
  caseId,
}: {
  evidence: EvidenceEntry[];
  caseId: string;
}) {
  if (evidence.length === 0) {
    return null;
  }

  return (
    <details className={PANEL_CLASS}>
      <summary className="cursor-pointer text-xl font-bold">
        Supporting Materials
      </summary>
      <div className="mt-4 space-y-4">
        {evidence.map((entry, index) => {
          const label = getEvidenceLabel(entry, index);
          const title = entry.title ? `${label}: ${entry.title}` : label;
          const exhibit: RequestContentFile = {
            name: title,
            fileId: entry.docId,
            sourceUrl: entry.sourceUrl,
            pages: formatPages(entry.pages),
          };
          const hasStructuredMetadata = hasStructuredMetadataTag(
            entry.metadata.tags,
          );
          const contentParts = [
            entry.headers.length > 0
              ? '**Headers:** ' + entry.headers.join(' / ')
              : null,
          ];
          if (!hasStructuredMetadata) {
            contentParts.push(...entry.snippets.map(formatPageContentMarkdown));
          }
          const markdownContent = contentParts
            .filter(isNonEmptyString)
            .join('\n\n');

          return (
            <div
              key={entry.docId}
              id={getEvidenceAnchorId(entry.docId)}
              className="scroll-mt-24">
              <ExhibitViewer
                exhibit={exhibit}
                caseId={caseId}
                viewerUrl={getPreviewableSourceUrl(entry.sourceUrl, caseId)}
                markdownContent={markdownContent || undefined}
                metadataContent={
                  hasStructuredMetadata ? (
                    <StructuredEvidenceMetadataTable
                      metadata={entry.metadata}
                    />
                  ) : undefined
                }
                tags={entry.metadata.tags}
                collapsible
                defaultOpenDesktop={false}
              />
            </div>
          );
        })}
      </div>
    </details>
  );
}

function ValidationStatusList({
  validations,
  evidence,
}: {
  validations?: ArgumentBuilderValidation[];
  evidence: EvidenceEntry[];
}) {
  if (!validations || validations.length === 0) {
    return null;
  }

  const evidenceByDocId = new Map(
    evidence.map((entry, index) => [
      entry.docId,
      { entry, label: getEvidenceLabel(entry, index) },
    ]),
  );

  const validationContent = (
    <div className="space-y-4">
      {validations.map((validation, index) => (
        <article
          key={index}
          className="rounded-md border border-slate-100 bg-slate-50 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100">
          <div className="mb-2 flex flex-wrap gap-2 text-xs">
            {validation.isValid !== undefined && (
              <span
                className={
                  validation.isValid
                    ? 'rounded bg-green-100 px-2 py-1 text-green-700 dark:bg-green-500/15 dark:text-green-300'
                    : 'rounded bg-red-100 px-2 py-1 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                }>
                {validation.isValid ? 'Valid' : 'Invalid'}
              </span>
            )}
            {validation.isInferred && (
              <span className="rounded bg-blue-100 px-2 py-1 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                Inferred
              </span>
            )}
            {validation.isSummaryOrConclusion && (
              <span className="rounded bg-purple-100 px-2 py-1 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">
                Summary
              </span>
            )}
            {validation.isContradictory && (
              <span className="rounded bg-orange-100 px-2 py-1 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                Contradictory
              </span>
            )}
          </div>
          {validation.explanation && (
            <div className={MARKDOWN_CONTENT_CLASS + ' mt-2 text-sm'}>
              <Markdown remarkPlugins={[remarkGfm]}>
                {validation.explanation}
              </Markdown>
            </div>
          )}
          {validation.contradictionStatement && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-red-700 dark:text-red-300">
              {validation.contradictionStatement}
            </p>
          )}
          {validation.sources &&
            validation.sources.some((source) =>
              evidenceByDocId.has(source.docId),
            ) && (
              <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Sources:</span>{' '}
                {validation.sources
                  .filter((source) => evidenceByDocId.has(source.docId))
                  .map((source, sourceIndex) => {
                    const evidenceMatch = evidenceByDocId.get(source.docId)!;
                    const pages = formatPages(source.pages);
                    const sourceText = pages
                      ? `${evidenceMatch.label} pages ${pages}`
                      : evidenceMatch.label;

                    return (
                      <span key={`${source.docId}-${sourceIndex}`}>
                        {sourceIndex > 0 && '; '}
                        <a
                          className="text-blue-600 hover:underline dark:text-blue-400"
                          href={`#${getEvidenceAnchorId(evidenceMatch.entry.docId)}`}>
                          {sourceText}
                        </a>
                      </span>
                    );
                  })}
              </div>
            )}
        </article>
      ))}
    </div>
  );

  return (
    <>
      <details className={PANEL_CLASS + ' md:hidden'}>
        <summary className="cursor-pointer text-xl font-bold">
          Validation Report
        </summary>
        <div className="mt-3">{validationContent}</div>
      </details>
      <details className={PANEL_CLASS + ' hidden md:block'}>
        <summary className="cursor-pointer text-xl font-bold">
          Validation Report
        </summary>
        <div className="mt-3">{validationContent}</div>
      </details>
    </>
  );
}

export default function Page({
  params,
}: {
  params: Promise<{ case: string; requestId: string }>;
}) {
  const { case: caseId, requestId } = use(params);
  const { fetchWithAuth } = useAuth();
  const [requestData, setRequestData] = useState<RequestData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetchWithAuth(
          `/api/accounts/cases/${caseId}/requests/${requestId}`,
          {
            method: 'GET',
            cache: 'no-store',
            signal: abortController.signal,
          },
        );

        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }

        const json = await response.json();
        setRequestData(parseRequestData(json));
      } catch (caughtError) {
        const error = caughtError as Error;
        if (error.name === 'AbortError') {
          return;
        }
        logger.error('Failed to load argument builder request:', error);
        setError('Failed to load the argument builder request.');
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    })();

    return () => abortController.abort();
  }, [caseId, fetchWithAuth, requestId]);

  const output = useMemo(() => {
    if (!requestData?.output) {
      return null;
    }
    return parseArgumentBuilderOutput(requestData.output);
  }, [requestData?.output]);

  const evidence = useMemo(() => {
    return output ? buildEvidenceEntries(output) : [];
  }, [output]);

  const evidenceAnchorTargets = useMemo(() => {
    return buildEvidenceAnchorTargets(evidence);
  }, [evidence]);

  return (
    <CasePageTemplate
      title="Argument Viewer"
      isLoading={isLoading}
      params={params}
      showBreadcrumbs={false}
      currentPath={['argument-builder', requestId]}
      actionNotice={<AiOutputNotice />}>
      <div className="mb-4">
        <Link
          href={`/cases/${caseId}/argument-builder`}
          className="text-blue-600 hover:underline dark:text-blue-400">
          Back to Argument List
        </Link>
      </div>

      {error && (
        <div
          className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
          role="alert">
          {error}
        </div>
      )}

      {!error && requestData && (
        <div className="space-y-4" data-testid="argument-viewer-content">
          <RequestSummary request={requestData} />
          {output ? (
            <>
              <MarkdownSection
                title="First Draft Argument"
                content={output.initialArgument}
                collapsible
                duplicateHeadingTitles={[
                  'First Draft Argument',
                  'Initial Argument',
                ]}
                evidenceAnchorTargets={evidenceAnchorTargets}
              />
              <MarkdownSection
                title="Anticipated Counter Argument"
                content={output.counterArgument}
                collapsible
                duplicateHeadingTitles={[
                  'Anticipated Counter Argument',
                  'Counter Argument',
                ]}
                evidenceAnchorTargets={evidenceAnchorTargets}
              />
              <MarkdownSection
                title="Final Argument"
                content={output.finalArgument}
                evidenceAnchorTargets={evidenceAnchorTargets}
              />
              <EvidenceSection evidence={evidence} caseId={caseId} />
              <ValidationStatusList
                validations={output.validationStatus}
                evidence={evidence}
              />
            </>
          ) : (
            <section className={PANEL_CLASS}>
              <h2 className="text-xl font-bold mb-3">Result</h2>
              <p>No argument builder result is available yet.</p>
            </section>
          )}
        </div>
      )}
    </CasePageTemplate>
  );
}
