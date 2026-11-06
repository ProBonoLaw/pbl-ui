import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf-8');
}

test('CaseForm validates record against OriginalCaseDetailsSchema before submit', () => {
  const source = read('components/cases/CaseForm.tsx');
  assert.match(
    source,
    /OriginalCaseDetailsSchema\.safeParse\(\s*updatedData\.record/,
  );
});

test('create-case API validates request against schema before processing', () => {
  const source = read('app/api/accounts/cases/route.ts');
  assert.match(source, /parseOriginalCaseRecordRequest\(body\)/);
});

test('update-case API validates body schema before update', () => {
  const source = read('app/api/accounts/cases/[caseId]/route.ts');
  assert.match(source, /CaseMapModel\.parse\(body\)/);
});

test('DB update path validates merged account object before replace', () => {
  const source = read('lib/accountInfo.ts');
  assert.match(
    source,
    /OriginalCaseDetailsSchema\.safeParse\(updatedAccount\)/,
  );
  assert.match(source, /throw new AccountInfoValidationError\(/);
});

test('update-case API maps merged validation errors to 400', () => {
  const source = read('app/api/accounts/cases/[caseId]/route.ts');
  assert.match(source, /e instanceof AccountInfoValidationError/);
  assert.match(source, /\{\s*status:\s*400\s*\}/);
});

test('create-case API billing code validation only allows S1, G1, F, and D', () => {
  const source = read('lib/types.ts');
  const declaration = source.match(
    /export const BillingCodeSchema\s*=\s*z\.enum\(\s*\[(?<members>[\s\S]*?)\]\s*\)/,
  );
  assert.ok(
    declaration?.groups?.members,
    'BillingCodeSchema declaration not found',
  );

  const enumMembers = declaration.groups.members.matchAll(
    /['"](?<value>[^'"]+)['"]/g,
  );
  const allowedValues = new Set(
    Array.from(enumMembers, (entry) => entry.groups?.value),
  );
  allowedValues.delete(undefined);

  assert.equal(allowedValues.size, 4);
  assert.deepEqual(Array.from(allowedValues).sort(), ['D', 'F', 'G1', 'S1']);
  assert.match(source, /billingCode: BillingCodeSchema\.optional\(\),/);
});

test('CaseAccountSchema defaults missing case terms acceptance to false', () => {
  const source = read('lib/types.ts');
  assert.match(source, /agreedToCaseTerms: z\.boolean\(\)\.default\(false\),/);
});

test('CaseAccountSchema supports active and expiry visibility fields', async () => {
  const { CaseAccountSchema, isCaseAccountVisible } =
    await import('../lib/types.ts');
  const now = new Date('2026-06-21T12:00:00.000Z');

  const activeCase = CaseAccountSchema.parse({
    accountId: '00000000-0000-4000-8000-000000001092',
    caseNumber: 'VISIBLE-1',
    expiry: '2026-06-22T12:00:00.000Z',
  });
  assert.ok(activeCase.expiry instanceof Date);
  assert.equal(isCaseAccountVisible(activeCase, now), true);

  const inactiveCase = CaseAccountSchema.parse({
    accountId: '00000000-0000-4000-8000-000000001093',
    caseNumber: 'INACTIVE-1',
    isActive: false,
  });
  assert.equal(isCaseAccountVisible(inactiveCase, now), false);

  const expiredCase = CaseAccountSchema.parse({
    accountId: '00000000-0000-4000-8000-000000001094',
    caseNumber: 'EXPIRED-1',
    expiry: '2026-06-20T12:00:00.000Z',
  });
  assert.equal(isCaseAccountVisible(expiredCase, now), false);
});

test('case sharing unlink soft-deactivates guests and hard-removes owners', () => {
  const source = read(
    'app/api/accounts/cases/[caseId]/users/[userId]/route.ts',
  );

  const deleteHandler =
    source.match(/export async function DELETE[\s\S]*/)?.[0] ?? '';

  assert.doesNotMatch(deleteHandler, /UserAccountsSchema\.parse\(items\)/);
  assert.match(deleteHandler, /CaseAccountSchema\.parse/);
  assert.match(
    source,
    /matchingCaseAccount\.isGuest === true[\s\S]*matchingCaseAccount\.isActive = false[\s\S]*sendSharePointAccessEvent/,
  );
  assert.match(
    source,
    /matchedUser\.casesAccounts\.splice\(matchingCaseAccountIndex, 1\)/,
  );
});

test('demo offer route offers shared demo cases only when due', () => {
  const source = read('app/api/accounts/demo-offer/route.ts');
  const layoutSource = read('components/AppLayout.tsx');

  assert.match(source, /DEMO_ACCOUNT_IDS/);
  assert.match(source, /visibleCases\.length > 0/);
  assert.match(source, /nextOffer\.getTime\(\) < now\.getTime\(\)/);
  assert.match(source, /OFFER_DELAY_MS/);
  assert.match(source, /acceptedOffer: false[\s\S]*nextOffer/);
  assert.match(source, /isGuest: true[\s\S]*isActive: true/);
  assert.match(layoutSource, /account:cases-changed/);
});

test('active guest case access is allowed for inactive demo users', () => {
  const accessSource = read('lib/userAccess.ts');
  const caseRouteSource = read('app/api/accounts/cases/[caseId]/route.ts');

  assert.match(accessSource, /allowInactiveGuestAccess\?: boolean/);
  assert.match(
    accessSource,
    /options\.allowInactiveGuestAccess === true[\s\S]*caseAccount\.isGuest === true/,
  );
  assert.match(
    caseRouteSource,
    /requireIsActive: true,[\s\S]*allowInactiveGuestAccess: true,[\s\S]*requireCaseTerms: false/,
  );
});

test('withCaseTermsAccepted preserves offeredDemo and transformed requestDate values', async () => {
  const { UserAccountModel } = await import('../lib/types.ts');
  const requestDate = '2026-06-19T12:00:00.000Z';
  const parsedNullOffer = UserAccountModel.parse({
    emailAddresses: ['user@example.com'],
    oids: ['00000000-0000-4000-8000-000000001096'],
    accountId: '00000000-0000-0000-0000-000000000000',
    agreedToTerms: true,
    isActive: true,
    offeredDemo: null,
    casesAccounts: [],
  });
  assert.equal(parsedNullOffer.offeredDemo, undefined);

  const parsed = UserAccountModel.parse({
    emailAddresses: ['user@example.com'],
    oids: ['00000000-0000-4000-8000-000000001095'],
    accountId: '00000000-0000-0000-0000-000000000000',
    agreedToTerms: true,
    isActive: true,
    offeredDemo: {
      acceptedOffer: false,
      nextOffer: '2026-06-20T12:00:00.000Z',
      lastOffer: '2026-06-18T12:00:00.000Z',
    },
    casesAccounts: [
      {
        accountId: '00000000-0000-4000-8000-000000001092',
        caseNumber: 'DEMO-TERMS-1',
        agreedToCaseTerms: false,
        requestDate,
      },
    ],
  });

  const updated = UserAccountModel.withCaseTermsAccepted(
    parsed,
    '00000000-0000-4000-8000-000000001092',
  );

  assert.deepEqual(updated.offeredDemo, {
    acceptedOffer: false,
    nextOffer: '2026-06-20T12:00:00.000Z',
    lastOffer: '2026-06-18T12:00:00.000Z',
  });
  assert.equal(updated.casesAccounts[0].agreedToCaseTerms, true);
  assert.ok(updated.casesAccounts[0].requestDate instanceof Date);
  assert.equal(
    updated.casesAccounts[0].requestDate?.toISOString(),
    requestDate,
  );
});

test('bar admissions are validated for storage but excluded from account responses', async () => {
  const { StoredUserAccountSchema, UserAccountSchema } = await import(
    '../lib/types.ts'
  );
  const account = StoredUserAccountSchema.parse({
    emailAddresses: ['attorney@example.com'],
    oids: ['00000000-0000-4000-8000-000000001097'],
    accountId: '00000000-0000-0000-0000-000000000000',
    agreedToTerms: true,
    isActive: true,
    barAdmissions: [
      {
        jurisdictionType: 'State',
        jurisdictionCode: 'OK',
        identifier: '12345',
      },
      {
        jurisdictionType: 'Federal',
        jurisdictionCode: 'OKND',
        identifier: '987654',
        courtType: 'DistrictCourt',
      },
      {
        jurisdictionType: 'Tribal',
        jurisdictionCode: 'CHEROKEE-NATION',
        identifier: 'CN-45678',
      },
    ],
    casesAccounts: [
      {
        accountId: '00000000-0000-4000-8000-000000001092',
        caseNumber: 'ADMISSIONS-1',
        requestDate: '2026-05-21T00:39:11.497Z',
      },
    ],
  });

  const publicAccount = UserAccountSchema.parse(account);
  assert.equal(
    publicAccount.casesAccounts[0].requestDate?.toISOString(),
    '2026-05-21T00:39:11.497Z',
  );
  assert.equal('barAdmissions' in publicAccount, false);
  assert.equal(
    StoredUserAccountSchema.safeParse({
      ...account,
      barAdmissions: [
        {
          jurisdictionType: 'International',
          jurisdictionCode: 'XX',
          identifier: '123',
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    StoredUserAccountSchema.safeParse({
      ...account,
      barAdmissions: [
        {
          jurisdictionType: 'Federal',
          jurisdictionCode: 'OKND',
          identifier: '987654',
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    StoredUserAccountSchema.safeParse({
      ...account,
      barAdmissions: [
        {
          jurisdictionType: 'Federal',
          jurisdictionCode: 'OKND',
          identifier: '987654',
          courtType: 'CircuitCourt',
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    StoredUserAccountSchema.safeParse({
      ...account,
      barAdmissions: [
        {
          jurisdictionType: 'State',
          jurisdictionCode: 'OK',
          identifier: '12345',
          courtType: 'DistrictCourt',
        },
      ],
    }).success,
    false,
  );
});

test('case participant endpoints return sanitized account projections', () => {
  const listRoute = read('app/api/accounts/cases/[caseId]/users/route.ts');
  const detailRoute = read(
    'app/api/accounts/cases/[caseId]/users/[userId]/route.ts',
  );

  assert.match(listRoute, /StoredUserAccountsSchema\.parse\(items\)/);
  assert.match(listRoute, /stripOtherCases\.map\(sanitizeUserAccount\)/);
  assert.match(detailRoute, /StoredUserAccountsSchema\.parse\(userItems\)/);
  assert.match(
    detailRoute,
    /NextResponse\.json\(sanitizeUserAccount\(stripOtherCases\)\)/,
  );
});
