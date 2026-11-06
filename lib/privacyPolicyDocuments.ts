import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { TERMS_AGREEMENTS_ROOT } from './termsOfService.ts';
import { parseMarkdownDocument } from './termsOfServiceDocuments.ts';

export type PrivacyPolicyDocument = {
  title: string;
  effectiveDate: string | null;
  markdown: string;
};

export const PRIVACY_POLICY_MARKDOWN_PATH = join(
  process.cwd(),
  TERMS_AGREEMENTS_ROOT,
  'privacy-policy',
  'default.md',
);

export async function getPrivacyPolicyDocument(): Promise<PrivacyPolicyDocument> {
  const markdown = await readFile(PRIVACY_POLICY_MARKDOWN_PATH, 'utf8');
  return parseMarkdownDocument(markdown, 'Privacy Policy');
}
