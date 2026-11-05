import assert from 'node:assert/strict';
import test from 'node:test';
import { printTitle } from '../lib/caseUtils.ts';
import type { OriginalCaseRecord } from '../lib/types.ts';

function makeCase(
  overrides: Partial<OriginalCaseRecord> = {},
): OriginalCaseRecord {
  return {
    type: 'ACCOUNT_DETAILS',
    caseNumber: 'CN-001',
    filingRole: 'Plaintiff',
    state: 'WA',
    county: 'King',
    description: 'Test case',
    personInformation: {
      firstName: 'Jane',
      lastName: 'Doe',
      organization: '',
      emailAddress: '',
      phoneNumber: '',
    },
    opposition: {
      firstName: 'John',
      lastName: 'Smith',
      organization: '',
      filingRole: 'Defendant',
      emailAddress: '',
      phoneNumber: '',
    },
    ...overrides,
  };
}

test('printTitle returns nickname first when present', () => {
  const record = makeCase({ nickname: 'Project Sunrise' });
  assert.equal(printTitle(record), 'Project Sunrise');
});

test('printTitle falls back to organization when first/last names are blank', () => {
  const record = makeCase({
    personInformation: {
      firstName: ' ',
      lastName: '',
      organization: 'Alpha Org',
      emailAddress: '',
      phoneNumber: '',
    },
    opposition: {
      firstName: '',
      lastName: ' ',
      organization: 'Beta LLC',
      filingRole: 'Defendant',
      emailAddress: '',
      phoneNumber: '',
    },
  });

  assert.equal(printTitle(record), 'Alpha Org v. Beta LLC');
});

test('printTitle uses role ordering for non-plaintiff/non-petitioner filing roles', () => {
  const record = makeCase({
    filingRole: 'Respondent',
    personInformation: {
      firstName: 'Jane',
      lastName: 'Doe',
      organization: '',
      emailAddress: '',
      phoneNumber: '',
    },
    opposition: {
      firstName: 'John',
      lastName: 'Smith',
      organization: '',
      filingRole: 'Petitioner',
      emailAddress: '',
      phoneNumber: '',
    },
  });

  assert.equal(printTitle(record), 'John Smith v. Jane Doe');
});

test('printTitle returns Unknown for missing records', () => {
  assert.equal(printTitle(undefined), 'Unknown');
});
