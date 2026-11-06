export type AccessPolicyInput = {
  agreedToTerms: boolean;
  isActive: boolean;
  requireAgreedToTerms?: boolean;
  requireIsActive?: boolean;
};

export type AccessPolicyResult = {
  allowed: boolean;
  code?: 'TERMS_NOT_ACCEPTED' | 'ACCOUNT_INACTIVE';
  message?: string;
};

export type CaseFeatureKey =
  | 'canGenerateDeclaration'
  | 'canUseQA'
  | 'canAccessDocuments';

export type CaseFeatureInput = {
  agreedToCaseTerms?: boolean;
  isGuest?: boolean;
  requiredFeature?: CaseFeatureKey;
  canGenerateDeclaration?: boolean;
  canUseQA?: boolean;
  canAccessDocuments?: boolean;
};

export type CaseFeatureResult = {
  allowed: boolean;
  code?:
    | 'CASE_TERMS_NOT_ACCEPTED'
    | 'CASE_QA_FORBIDDEN'
    | 'CASE_DECLARATION_FORBIDDEN'
    | 'CASE_DOCUMENTS_FORBIDDEN';
  message?: string;
};

export function evaluateUserAccessPolicy(
  input: AccessPolicyInput,
): AccessPolicyResult {
  if (input.requireAgreedToTerms && !input.agreedToTerms) {
    return {
      allowed: false,
      code: 'TERMS_NOT_ACCEPTED',
      message: 'You must agree to terms before creating a case.',
    };
  }

  if (input.requireIsActive && !input.isActive) {
    return {
      allowed: false,
      code: 'ACCOUNT_INACTIVE',
      message: 'Your account is inactive.',
    };
  }

  return { allowed: true };
}

const CASE_FEATURE_ERRORS: Record<
  CaseFeatureKey,
  { code: CaseFeatureResult['code']; message: string }
> = {
  canUseQA: {
    code: 'CASE_QA_FORBIDDEN',
    message:
      'You do not have permission to use QA for this case. Please contact the case owner.',
  },
  canGenerateDeclaration: {
    code: 'CASE_DECLARATION_FORBIDDEN',
    message:
      'You do not have permission to generate declarations for this case. Please contact the case owner.',
  },
  canAccessDocuments: {
    code: 'CASE_DOCUMENTS_FORBIDDEN',
    message:
      'You do not have permission to access documents for this case. Please contact the case owner.',
  },
};

export function evaluateCaseFeaturePolicy(
  input: CaseFeatureInput,
): CaseFeatureResult {
  if (input.agreedToCaseTerms !== true) {
    return {
      allowed: false,
      code: 'CASE_TERMS_NOT_ACCEPTED',
      message:
        'You must accept the case terms of service before accessing this case.',
    };
  }

  if (!input.requiredFeature || input.isGuest !== true) {
    return { allowed: true };
  }

  if (input[input.requiredFeature] !== true) {
    const featureError = CASE_FEATURE_ERRORS[input.requiredFeature];
    return {
      allowed: false,
      code: featureError.code,
      message: featureError.message,
    };
  }

  return { allowed: true };
}
