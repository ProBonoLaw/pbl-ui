import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateCaseFeaturePolicy,
  evaluateUserAccessPolicy,
} from '../lib/userAccessPolicy.ts';

test('blocks creation when terms are required but not accepted', () => {
  const result = evaluateUserAccessPolicy({
    agreedToTerms: false,
    isActive: true,
    requireAgreedToTerms: true,
    requireIsActive: true,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.code, 'TERMS_NOT_ACCEPTED');
});

test('allows existing case interactions when active and terms are not required', () => {
  const result = evaluateUserAccessPolicy({
    agreedToTerms: false,
    isActive: true,
    requireIsActive: true,
  });

  assert.deepEqual(result, { allowed: true });
});

test('blocks when active is required and account is inactive', () => {
  const result = evaluateUserAccessPolicy({
    agreedToTerms: true,
    isActive: false,
    requireIsActive: true,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.code, 'ACCOUNT_INACTIVE');
});

test('allows when no restrictions are required', () => {
  const result = evaluateUserAccessPolicy({
    agreedToTerms: false,
    isActive: false,
  });

  assert.deepEqual(result, { allowed: true });
});

test('blocks case access when case terms are omitted', () => {
  const result = evaluateCaseFeaturePolicy({});

  assert.equal(result.allowed, false);
  assert.equal(result.code, 'CASE_TERMS_NOT_ACCEPTED');
  assert.equal(
    result.message,
    'You must accept the case terms of service before accessing this case.',
  );
});

test('blocks case access when case terms are false', () => {
  const result = evaluateCaseFeaturePolicy({ agreedToCaseTerms: false });

  assert.equal(result.allowed, false);
  assert.equal(result.code, 'CASE_TERMS_NOT_ACCEPTED');
  assert.equal(
    result.message,
    'You must accept the case terms of service before accessing this case.',
  );
});

test('allows owners to use QA regardless of guest feature flags', () => {
  const result = evaluateCaseFeaturePolicy({
    agreedToCaseTerms: true,
    isGuest: false,
    requiredFeature: 'canUseQA',
    canUseQA: false,
  });

  assert.deepEqual(result, { allowed: true });
});

test('treats missing isGuest as owner and does not enforce guest feature flags', () => {
  const result = evaluateCaseFeaturePolicy({
    agreedToCaseTerms: true,
    requiredFeature: 'canUseQA',
    canUseQA: false,
  });

  assert.deepEqual(result, { allowed: true });
});

test('blocks guest QA access when canUseQA is false', () => {
  const result = evaluateCaseFeaturePolicy({
    agreedToCaseTerms: true,
    isGuest: true,
    requiredFeature: 'canUseQA',
    canUseQA: false,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.code, 'CASE_QA_FORBIDDEN');
});

test('blocks guest declaration access when canGenerateDeclaration is false', () => {
  const result = evaluateCaseFeaturePolicy({
    agreedToCaseTerms: true,
    isGuest: true,
    requiredFeature: 'canGenerateDeclaration',
    canGenerateDeclaration: false,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.code, 'CASE_DECLARATION_FORBIDDEN');
});

test('allows guest document access when canAccessDocuments is true', () => {
  const result = evaluateCaseFeaturePolicy({
    agreedToCaseTerms: true,
    isGuest: true,
    requiredFeature: 'canAccessDocuments',
    canAccessDocuments: true,
  });

  assert.deepEqual(result, { allowed: true });
});
