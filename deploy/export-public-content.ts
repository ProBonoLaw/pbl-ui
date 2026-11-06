import { mkdir, writeFile } from 'node:fs/promises';
import { LEGAL_DOCUMENTS, getLegalDocument, type LegalDocumentId } from '../lib/legalDocuments';
import { getPrivacyPolicyDocument } from '../lib/privacyPolicyDocuments';

const legal = Object.fromEntries(await Promise.all(
  Object.keys(LEGAL_DOCUMENTS).map(async key => {
    const { id, title, href, version, lastModified, markdown, contentHash } = await getLegalDocument(key as LegalDocumentId);
    return [key, { id, title, href, version, lastModified, markdown, contentHash }];
  }),
));
await mkdir('frontend/generated', { recursive: true });
await writeFile('frontend/generated/public-content.json', JSON.stringify({
  legal, privacy: await getPrivacyPolicyDocument(),
}));
