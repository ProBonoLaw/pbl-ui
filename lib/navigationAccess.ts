export type CaseNavigationAccessInput = {
  agreedToTerms?: boolean | null;
  agreedToCaseTerms?: boolean | null;
  isGuest?: boolean;
};

export type CaseFeatureNavigationAccessInput = {
  agreedToCaseTerms?: boolean | null;
  isGuest?: boolean;
  canGenerateDeclaration?: boolean;
  canUseQA?: boolean;
  canAccessDocuments?: boolean;
};

export function shouldHideEditAndStatistics(
  input: CaseNavigationAccessInput,
): boolean {
  return (
    input.agreedToTerms === false ||
    input.agreedToCaseTerms !== true ||
    input.isGuest === true
  );
}

export function canSeeEditAndStatistics(
  input: CaseNavigationAccessInput,
): boolean {
  return !shouldHideEditAndStatistics(input);
}

export function canSeeCaseQaNavigation(
  input: CaseFeatureNavigationAccessInput,
): boolean {
  if (input.agreedToCaseTerms !== true) {
    return false;
  }
  if (input.isGuest !== true) {
    return true;
  }
  return input.canUseQA === true;
}

export function canSeeCaseDeclarationNavigation(
  input: CaseFeatureNavigationAccessInput,
): boolean {
  if (input.agreedToCaseTerms !== true) {
    return false;
  }
  if (input.isGuest !== true) {
    return true;
  }
  return input.canGenerateDeclaration === true;
}

export function canSeeCaseArgumentNavigation(
  input: CaseFeatureNavigationAccessInput,
): boolean {
  return canSeeCaseDeclarationNavigation(input);
}

export function canSeeCaseTimelineNavigation(
  input: CaseFeatureNavigationAccessInput,
): boolean {
  return canSeeCaseDeclarationNavigation(input);
}

export function canSeeCaseDocumentsNavigation(
  input: CaseFeatureNavigationAccessInput,
): boolean {
  if (input.agreedToCaseTerms !== true) {
    return false;
  }
  if (input.isGuest !== true) {
    return true;
  }
  return input.canAccessDocuments === true;
}

export function canSeeCaseEvidenceNavigation(
  input: CaseFeatureNavigationAccessInput,
): boolean {
  return canSeeCaseDocumentsNavigation(input);
}

export function canSeeCaseShareNavigation(
  input: CaseFeatureNavigationAccessInput,
): boolean {
  if (input.agreedToCaseTerms !== true) {
    return false;
  }
  return input.isGuest !== true;
}

export function getCaseRouteRedirectPath(
  pathname: string,
  caseId: string,
  input: CaseFeatureNavigationAccessInput,
): string | null {
  if (pathname === `/cases/${caseId}/qa` && !canSeeCaseQaNavigation(input)) {
    return `/cases/${caseId}`;
  }

  if (
    pathname.startsWith(`/cases/${caseId}/declarations`) &&
    !canSeeCaseDeclarationNavigation(input)
  ) {
    return `/cases/${caseId}`;
  }

  if (
    pathname.startsWith(`/cases/${caseId}/argument-builder`) &&
    !canSeeCaseArgumentNavigation(input)
  ) {
    return `/cases/${caseId}`;
  }

  if (
    pathname.startsWith(`/cases/${caseId}/timeline`) &&
    !canSeeCaseTimelineNavigation(input)
  ) {
    return `/cases/${caseId}`;
  }

  if (
    pathname.startsWith(`/cases/${caseId}/documents`) &&
    !canSeeCaseDocumentsNavigation(input)
  ) {
    return `/cases/${caseId}`;
  }

  if (
    pathname.startsWith(`/cases/${caseId}/evidence`) &&
    !canSeeCaseEvidenceNavigation(input)
  ) {
    return `/cases/${caseId}`;
  }

  if (
    pathname.startsWith(`/cases/${caseId}/share`) &&
    !canSeeCaseShareNavigation(input)
  ) {
    return `/cases/${caseId}`;
  }

  return null;
}
