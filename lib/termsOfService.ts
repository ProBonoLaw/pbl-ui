import type { BillingCode } from './types';

export const TERMS_OF_SERVICE_TYPES = [
  'general',
  'demo',
  'silver',
  'gold',
  'pro-bono',
] as const;

export const TERMS_OF_SERVICE_SCOPES = ['user-account', 'case'] as const;

export type TermsOfServiceType = (typeof TERMS_OF_SERVICE_TYPES)[number];
export type TermsOfServiceScope = (typeof TERMS_OF_SERVICE_SCOPES)[number];

export type TermsOfServiceDocument = {
  title: string;
  effectiveDate: string | null;
  markdown: string;
  acknowledgement: string;
};

export type TermsDocumentMetadata = {
  fallbackTitle: string;
  acknowledgement: string;
  candidateFiles: string[];
};

export const TERMS_AGREEMENTS_ROOT = 'lib/terms-of-service-agreements';

const CASE_TERMS_METADATA: Record<TermsOfServiceType, TermsDocumentMetadata> = {
  general: {
    fallbackTitle: 'Case Terms of Service',
    acknowledgement:
      'I have read and agree to the standard case terms of service for this matter.',
    candidateFiles: ['default.md', 'general.md'],
  },
  demo: {
    fallbackTitle: 'Demo Case Terms of Service',
    acknowledgement:
      'I have read and agree to the demo case terms of service for this matter.',
    candidateFiles: ['d.md', 'demo.md'],
  },
  silver: {
    fallbackTitle: 'Silver Case Terms of Service',
    acknowledgement:
      'I have read and agree to the Silver case terms of service for this matter.',
    candidateFiles: ['s1.md', 'silver.md'],
  },
  gold: {
    fallbackTitle: 'Gold Case Terms of Service',
    acknowledgement:
      'I have read and agree to the Gold case terms of service for this matter.',
    candidateFiles: ['g1.md', 'gold.md'],
  },
  'pro-bono': {
    fallbackTitle: 'Pro Bono Case Terms of Service',
    acknowledgement:
      'I have read and agree to the pro bono case terms of service for this matter.',
    candidateFiles: ['f.md', 'pro-bono.md'],
  },
};

const USER_ACCOUNT_TERMS_METADATA: TermsDocumentMetadata = {
  fallbackTitle: 'Terms of Service',
  acknowledgement:
    'I have read and agree to the Pro Bono Law Terms of Service.',
  candidateFiles: ['default.md'],
};

export function getTermsTypeForBillingCode(
  billingCode?: BillingCode | null,
): TermsOfServiceType {
  switch (billingCode) {
    case 'D':
      return 'demo';
    case 'S1':
      return 'silver';
    case 'G1':
      return 'gold';
    case 'F':
      return 'pro-bono';
    default:
      return 'general';
  }
}

export function getTermsDocumentMetadata({
  scope,
  termsType,
}: {
  scope: TermsOfServiceScope;
  termsType: TermsOfServiceType;
}): TermsDocumentMetadata {
  if (scope === 'user-account') {
    return USER_ACCOUNT_TERMS_METADATA;
  }

  return CASE_TERMS_METADATA[termsType];
}

export function getAgreementFolder(
  scope: TermsOfServiceScope,
): 'case' | 'user' {
  return scope === 'case' ? 'case' : 'user';
}
