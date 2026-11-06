import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import JSZip from 'jszip';

import { PRIVACY_POLICY_MARKDOWN_PATH } from './privacyPolicyDocuments';
import { TERMS_AGREEMENTS_ROOT } from './termsOfService';

export const LEGAL_DOCUMENTS = {
  terms: {
    id: 'terms', title: 'Terms of Service', href: '/terms',
    version: '2026.10.31-v1', lastModified: 'October 31, 2026',
    markdownPath: join(process.cwd(), TERMS_AGREEMENTS_ROOT, 'user', 'default.md'),
  },
  privacy: {
    id: 'privacy', title: 'Privacy Policy', href: '/privacy',
    version: '2026.10.31-v1', lastModified: 'October 31, 2026', markdownPath: PRIVACY_POLICY_MARKDOWN_PATH,
  },
  baa: { id: 'baa', title: 'Business Associate Agreement', href: '/baa', version: '2026.10.31-v1', lastModified: 'October 31, 2026', archiveName: '2026.10.31_Pro Bono Law LLC_Customer BAA_v1.docx' },
  dpa: { id: 'dpa', title: 'Data Processing Addendum', href: '/dpa', version: '2026.07.11-v1', lastModified: 'July 11, 2026', archiveName: '2026.07.11_Pro Bono Law LLC_DPA_v1.docx' },
  aup: { id: 'aup', title: 'Acceptable Use Policy', href: '/aup', version: '2026.10.31-v1', lastModified: 'October 31, 2026', archiveName: '2026.10.31_Pro Bono Law LLC_AUP_v1.docx' },
  'end-client-terms': { id: 'end-client-terms', title: 'End-Client Terms', href: '/end-client-terms', version: '2026.10.31-v1', lastModified: 'October 31, 2026', archiveName: '2026.10.31_Pro Bono Law LLC_End-Client Agreement_v1.docx' },
} as const;

export type LegalDocumentId = keyof typeof LEGAL_DOCUMENTS;
export type LegalDocument = (typeof LEGAL_DOCUMENTS)[LegalDocumentId] & { markdown: string; contentHash: string };

const archivePath = process.env.LEGAL_DOCUMENT_ARCHIVE_PATH || join(process.cwd(), 'archives', 'TermsAndAgreements.zip');

function decodeXml(value: string) {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)));
}

type LegalArchive = Awaited<ReturnType<typeof JSZip.loadAsync>>;

async function loadLegalArchive(): Promise<LegalArchive> {
  return JSZip.loadAsync(await readFile(/* turbopackIgnore: true */ archivePath));
}

async function readArchiveDocument(
  archive: LegalArchive,
  archiveName: string,
) {
  const entry = archive.file(`GA Package/${archiveName}`);
  if (!entry) throw new Error(`Legal document is missing from the immutable archive: ${archiveName}`);
  const documentXml = await entry.async('nodebuffer').then(async (docx) => {
    const docxZip = await JSZip.loadAsync(docx);
    return docxZip.file('word/document.xml')?.async('string');
  });
  if (!documentXml) throw new Error(`Legal document cannot be read: ${archiveName}`);
  return decodeXml(documentXml
    .replace(/<w:p[^>]*>/g, '\n\n')
    .replace(/<w:tab\/>/g, '  ')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim());
}

async function readLegalDocument(
  id: LegalDocumentId,
  archive?: LegalArchive,
): Promise<LegalDocument> {
  const document = LEGAL_DOCUMENTS[id];
  const markdown = 'markdownPath' in document
    ? await readFile(document.markdownPath, 'utf8')
    : await readArchiveDocument(
        archive ?? (await loadLegalArchive()),
        document.archiveName,
      );
  return { ...document, markdown, contentHash: createHash('sha256').update(markdown).digest('hex') };
}

export async function getLegalDocument(id: LegalDocumentId): Promise<LegalDocument> {
  return readLegalDocument(id);
}

export function getClickwrapDocumentIds(userType: 'attorney' | 'end-client'): LegalDocumentId[] {
  return userType === 'attorney'
    ? ['terms', 'privacy', 'baa', 'dpa', 'aup']
    : ['end-client-terms'];
}

export async function getClickwrapDocuments(userType: 'attorney' | 'end-client') {
  const archive = await loadLegalArchive();
  return Promise.all(
    getClickwrapDocumentIds(userType).map((id) =>
      readLegalDocument(id, archive),
    ),
  );
}
