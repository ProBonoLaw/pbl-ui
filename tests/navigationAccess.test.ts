import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canSeeCaseArgumentNavigation,
  canSeeCaseDeclarationNavigation,
  canSeeCaseDocumentsNavigation,
  canSeeCaseEvidenceNavigation,
  canSeeCaseQaNavigation,
  canSeeCaseShareNavigation,
  canSeeCaseTimelineNavigation,
  canSeeEditAndStatistics,
  getCaseRouteRedirectPath,
  shouldHideEditAndStatistics,
} from '../lib/navigationAccess.ts';

test('hides edit/statistics when agreedToTerms is false', () => {
  assert.equal(
    shouldHideEditAndStatistics({
      agreedToTerms: false,
      agreedToCaseTerms: true,
      isGuest: false,
    }),
    true,
  );
  assert.equal(
    canSeeEditAndStatistics({
      agreedToTerms: false,
      agreedToCaseTerms: true,
      isGuest: false,
    }),
    false,
  );
});

test('hides edit/statistics when user is a guest', () => {
  assert.equal(
    shouldHideEditAndStatistics({
      agreedToTerms: true,
      agreedToCaseTerms: true,
      isGuest: true,
    }),
    true,
  );
  assert.equal(
    canSeeEditAndStatistics({
      agreedToTerms: true,
      agreedToCaseTerms: true,
      isGuest: true,
    }),
    false,
  );
});

test('hides edit/statistics when both restrictions apply', () => {
  assert.equal(
    shouldHideEditAndStatistics({
      agreedToTerms: false,
      agreedToCaseTerms: true,
      isGuest: true,
    }),
    true,
  );
});

test('shows edit/statistics for non-guest who agreed to terms', () => {
  assert.equal(
    shouldHideEditAndStatistics({
      agreedToTerms: true,
      agreedToCaseTerms: true,
      isGuest: false,
    }),
    false,
  );
  assert.equal(
    canSeeEditAndStatistics({
      agreedToTerms: true,
      agreedToCaseTerms: true,
      isGuest: false,
    }),
    true,
  );
});

test('does not hide when agreedToTerms is unresolved and user is not guest', () => {
  assert.equal(
    shouldHideEditAndStatistics({
      agreedToTerms: undefined,
      agreedToCaseTerms: true,
      isGuest: false,
    }),
    false,
  );
});

test('hides case navigation when case terms are omitted or false', () => {
  assert.equal(canSeeCaseQaNavigation({ isGuest: false }), false);
  assert.equal(
    canSeeCaseDeclarationNavigation({
      agreedToCaseTerms: false,
      isGuest: false,
    }),
    false,
  );
  assert.equal(
    canSeeEditAndStatistics({ agreedToTerms: true, isGuest: false }),
    false,
  );
});

test('blocks guest QA navigation when canUseQA is false', () => {
  assert.equal(
    canSeeCaseQaNavigation({
      agreedToCaseTerms: true,
      isGuest: true,
      canUseQA: false,
    }),
    false,
  );
});

test('allows guest QA navigation when canUseQA is true', () => {
  assert.equal(
    canSeeCaseQaNavigation({
      agreedToCaseTerms: true,
      isGuest: true,
      canUseQA: true,
    }),
    true,
  );
});

test('blocks guest declaration navigation when canGenerateDeclaration is false', () => {
  assert.equal(
    canSeeCaseDeclarationNavigation({
      agreedToCaseTerms: true,
      isGuest: true,
      canGenerateDeclaration: false,
    }),
    false,
  );
});

test('allows guest declaration navigation when canGenerateDeclaration is true', () => {
  assert.equal(
    canSeeCaseDeclarationNavigation({
      agreedToCaseTerms: true,
      isGuest: true,
      canGenerateDeclaration: true,
    }),
    true,
  );
});

test('locks guest argument navigation with canGenerateDeclaration', () => {
  assert.equal(
    canSeeCaseArgumentNavigation({
      agreedToCaseTerms: true,
      isGuest: true,
      canGenerateDeclaration: false,
    }),
    false,
  );
  assert.equal(
    canSeeCaseArgumentNavigation({
      agreedToCaseTerms: true,
      isGuest: true,
      canGenerateDeclaration: true,
    }),
    true,
  );
});

test('locks guest timeline navigation with canGenerateDeclaration', () => {
  assert.equal(
    canSeeCaseTimelineNavigation({
      agreedToCaseTerms: true,
      isGuest: true,
      canGenerateDeclaration: false,
    }),
    false,
  );
  assert.equal(
    canSeeCaseTimelineNavigation({
      agreedToCaseTerms: true,
      isGuest: true,
      canGenerateDeclaration: true,
    }),
    true,
  );
});

test('blocks guest document navigation when canAccessDocuments is false', () => {
  assert.equal(
    canSeeCaseDocumentsNavigation({
      agreedToCaseTerms: true,
      isGuest: true,
      canAccessDocuments: false,
    }),
    false,
  );
});

test('allows guest document navigation when canAccessDocuments is true', () => {
  assert.equal(
    canSeeCaseDocumentsNavigation({
      agreedToCaseTerms: true,
      isGuest: true,
      canAccessDocuments: true,
    }),
    true,
  );
});

test('evidence navigation follows document access permissions', () => {
  assert.equal(
    canSeeCaseEvidenceNavigation({
      agreedToCaseTerms: true,
      isGuest: true,
      canAccessDocuments: false,
    }),
    false,
  );
  assert.equal(
    canSeeCaseEvidenceNavigation({
      agreedToCaseTerms: true,
      isGuest: true,
      canAccessDocuments: true,
    }),
    true,
  );
});

test('blocks guest share navigation', () => {
  assert.equal(
    canSeeCaseShareNavigation({ agreedToCaseTerms: true, isGuest: true }),
    false,
  );
});

test('allows owner navigation regardless of guest feature flags', () => {
  assert.equal(
    canSeeCaseQaNavigation({
      agreedToCaseTerms: true,
      isGuest: false,
      canUseQA: false,
    }),
    true,
  );
  assert.equal(
    canSeeCaseDeclarationNavigation({
      agreedToCaseTerms: true,
      isGuest: false,
      canGenerateDeclaration: false,
    }),
    true,
  );
  assert.equal(
    canSeeCaseArgumentNavigation({
      agreedToCaseTerms: true,
      isGuest: false,
      canGenerateDeclaration: false,
    }),
    true,
  );
  assert.equal(
    canSeeCaseTimelineNavigation({
      agreedToCaseTerms: true,
      isGuest: false,
      canGenerateDeclaration: false,
    }),
    true,
  );
  assert.equal(
    canSeeCaseDocumentsNavigation({
      agreedToCaseTerms: true,
      isGuest: false,
      canAccessDocuments: false,
    }),
    true,
  );
  assert.equal(
    canSeeCaseShareNavigation({ agreedToCaseTerms: true, isGuest: false }),
    true,
  );
});

test('redirects restricted case routes to case root', () => {
  const restricted = {
    agreedToCaseTerms: true,
    isGuest: true,
    canUseQA: false,
    canGenerateDeclaration: false,
    canAccessDocuments: false,
  };

  assert.equal(
    getCaseRouteRedirectPath('/cases/abc/qa', 'abc', restricted),
    '/cases/abc',
  );
  assert.equal(
    getCaseRouteRedirectPath('/cases/abc/declarations', 'abc', restricted),
    '/cases/abc',
  );
  assert.equal(
    getCaseRouteRedirectPath(
      '/cases/abc/declarations/request',
      'abc',
      restricted,
    ),
    '/cases/abc',
  );
  assert.equal(
    getCaseRouteRedirectPath('/cases/abc/argument-builder', 'abc', restricted),
    '/cases/abc',
  );
  assert.equal(
    getCaseRouteRedirectPath(
      '/cases/abc/argument-builder/request',
      'abc',
      restricted,
    ),
    '/cases/abc',
  );
  assert.equal(
    getCaseRouteRedirectPath(
      '/cases/abc/timeline/investigative/request',
      'abc',
      restricted,
    ),
    '/cases/abc',
  );
  assert.equal(
    getCaseRouteRedirectPath('/cases/abc/documents/folder', 'abc', restricted),
    '/cases/abc',
  );
  assert.equal(
    getCaseRouteRedirectPath('/cases/abc/evidence', 'abc', restricted),
    '/cases/abc',
  );
  assert.equal(
    getCaseRouteRedirectPath('/cases/abc/share/add', 'abc', restricted),
    '/cases/abc',
  );
});

test('does not redirect when route is allowed', () => {
  const allowedGuest = {
    agreedToCaseTerms: true,
    isGuest: true,
    canUseQA: true,
    canGenerateDeclaration: true,
    canAccessDocuments: true,
  };

  assert.equal(
    getCaseRouteRedirectPath('/cases/abc/qa', 'abc', allowedGuest),
    null,
  );
  assert.equal(
    getCaseRouteRedirectPath(
      '/cases/abc/declarations/request',
      'abc',
      allowedGuest,
    ),
    null,
  );
  assert.equal(
    getCaseRouteRedirectPath(
      '/cases/abc/argument-builder',
      'abc',
      allowedGuest,
    ),
    null,
  );
  assert.equal(
    getCaseRouteRedirectPath(
      '/cases/abc/argument-builder/request',
      'abc',
      allowedGuest,
    ),
    null,
  );
  assert.equal(
    getCaseRouteRedirectPath(
      '/cases/abc/timeline/investigative/request',
      'abc',
      allowedGuest,
    ),
    null,
  );
  assert.equal(
    getCaseRouteRedirectPath(
      '/cases/abc/documents/folder',
      'abc',
      allowedGuest,
    ),
    null,
  );
  assert.equal(
    getCaseRouteRedirectPath('/cases/abc/evidence', 'abc', allowedGuest),
    null,
  );
  assert.equal(
    getCaseRouteRedirectPath('/cases/abc/share', 'abc', {
      agreedToCaseTerms: true,
      isGuest: false,
    }),
    null,
  );
});
