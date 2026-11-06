import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  getAgreementFolder,
  getTermsDocumentMetadata,
  type TermsOfServiceDocument,
  type TermsOfServiceScope,
  type TermsOfServiceType,
} from './termsOfService.ts';

export class TermsOfServiceDocumentNotFoundError extends Error {
  constructor(scope: TermsOfServiceScope, termsType: TermsOfServiceType) {
    super('Terms of service document not found for ' + scope + ':' + termsType);
  }
}

async function readTermsMarkdown({
  scope,
  termsType,
  candidateFiles,
}: {
  scope: TermsOfServiceScope;
  termsType: TermsOfServiceType;
  candidateFiles: string[];
}): Promise<string> {
  const folder = getAgreementFolder(scope);

  for (const fileName of candidateFiles) {
    try {
      return await readFile(
        join(
          process.cwd(),
          'lib',
          'terms-of-service-agreements',
          folder,
          fileName,
        ),
        'utf8',
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  throw new TermsOfServiceDocumentNotFoundError(scope, termsType);
}

export function parseMarkdownDocument(
  markdown: string,
  fallbackTitle: string,
): {
  title: string;
  effectiveDate: string | null;
  markdown: string;
} {
  let body = markdown.replace(/\r\n/g, '\n').trim();
  let title = fallbackTitle;
  const h1Match = body.match(/^#\s+(.+)$/m);

  if (h1Match?.index === 0) {
    title = h1Match[1]?.trim() || fallbackTitle;
    body = body.slice(h1Match[0].length).trimStart();

    const h2Match = body.match(/^##\s+(.+)$/m);
    if (title === 'PRO BONO LAW LLC' && h2Match?.index === 0) {
      title = h2Match[1]?.trim() || title;
      body = body.slice(h2Match[0].length).trimStart();
    }
  }

  const metadataDatePattern =
    /^(?:Last Modified|Last Updated|Effective):\s*([^*_\n]+)$/i;
  let effectiveDate: string | null = null;
  const bodyLines = body.split('\n');

  while (bodyLines.length > 0) {
    const line = bodyLines[0].trim();
    if (!line) {
      bodyLines.shift();
      continue;
    }

    const unwrappedLine = line.replace(/^([*_])(.+)\1$/, '$2').trim();
    const dateMatch = unwrappedLine.match(metadataDatePattern);
    if (dateMatch) {
      effectiveDate = dateMatch[1]?.trim() || effectiveDate;
      bodyLines.shift();
      continue;
    }

    if (/^Hosted at\b/i.test(unwrappedLine)) {
      bodyLines.shift();
      continue;
    }

    if (/^Incorporated by reference\b/i.test(unwrappedLine)) {
      bodyLines.shift();
      continue;
    }

    break;
  }

  return { title, effectiveDate, markdown: bodyLines.join('\n').trimStart() };
}

export async function getTermsOfServiceDocument({
  scope,
  termsType,
}: {
  scope: TermsOfServiceScope;
  termsType: TermsOfServiceType;
}): Promise<TermsOfServiceDocument> {
  const metadata = getTermsDocumentMetadata({ scope, termsType });
  const markdown = await readTermsMarkdown({
    scope,
    termsType,
    candidateFiles: metadata.candidateFiles,
  });
  const parsedDocument = parseMarkdownDocument(
    markdown,
    metadata.fallbackTitle,
  );

  return {
    ...parsedDocument,
    acknowledgement: metadata.acknowledgement,
  };
}
