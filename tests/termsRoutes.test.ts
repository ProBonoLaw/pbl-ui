import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf-8');
}

test('terms document route validates and serves markdown-backed agreements', () => {
  const source = read('app/api/accounts/terms/route.ts');

  assert.match(source, /export async function GET\(request: NextRequest\)/);
  assert.match(source, /await validateRequestToken\(request\)/);
  assert.match(source, /TermsDocumentRequestSchema\.safeParse\(/);
  assert.match(source, /scope: request\.nextUrl\.searchParams\.get\('scope'\)/);
  assert.match(
    source,
    /termsType: request\.nextUrl\.searchParams\.get\('termsType'\)/,
  );
  assert.match(
    source,
    /userType: request\.nextUrl\.searchParams\.get\('userType'\)/,
  );
  assert.match(source, /getLegalDocument\('end-client-terms'\)/);
  assert.match(source, /getTermsOfServiceDocument\(parsedQuery\.data\)/);
  assert.match(source, /Invalid terms document request[\s\S]*status:\s*400/);
  assert.match(source, /Invalid or missing token[\s\S]*status:\s*401/);
  assert.match(source, /Terms agreement not found[\s\S]*status:\s*404/);
  assert.match(source, /Failed to load terms agreement[\s\S]*status:\s*500/);
});

test('terms acceptance route validates requests and persists user or case acceptance', () => {
  const source = read('app/api/accounts/terms/route.ts');

  assert.match(source, /export async function POST\(request: NextRequest\)/);
  assert.match(source, /const payload = await validateRequestToken\(request\)/);
  assert.match(source, /const oid = payload\.oid as string \| undefined/);
  assert.match(source, /Missing oid claim[\s\S]*status:\s*400/);
  assert.match(source, /TermsAcceptanceRequestSchema\.safeParse\(/);
  assert.match(source, /Invalid terms acceptance request[\s\S]*status:\s*400/);
  assert.match(
    source,
    /SELECT TOP 1 \* from c WHERE c\.accountId = @accountId AND array_contains\(c\.oids, @oid\)/,
  );
  assert.match(source, /User account is not initialized\.[\s\S]*status:\s*403/);
  assert.match(source, /termsRequest\.scope === 'user-account'/);
  assert.match(source, /account\.agreedToTerms = true/);
  assert.match(source, /mechanism: 'checked-checkbox and I Accept button'/);
  assert.doesNotMatch(source, /unchecked-checkbox/);
  assert.match(
    source,
    /account\.casesAccounts\?\.find\(\s*\(entry\) => entry\.accountId === caseId,/,
  );
  assert.match(
    source,
    /You do not have access to this case\.[\s\S]*status:\s*403/,
  );
  assert.match(source, /caseAccount\.agreedToCaseTerms = true/);
  assert.match(source, /await container\.items\.upsert\(account\)/);
  assert.match(source, /new NextResponse\(null, \{ status: 204 \}\)/);
  assert.match(source, /Invalid or missing token[\s\S]*status:\s*401/);
  assert.match(source, /Failed to save terms acceptance[\s\S]*status:\s*500/);
});

test('case details GET allows terms modal bootstrap and returns resolved terms billing code', () => {
  const source = read('app/api/accounts/cases/[caseId]/route.ts');

  assert.match(source, /getTermsBillingCodeForGuestCase/);
  assert.match(
    source,
    /await requireUserCaseAccess\(userId, caseId, \{\s*requireIsActive: true,\s*allowInactiveGuestAccess: true,\s*requireCaseTerms: false,\s*\}\)/,
  );
  assert.match(
    source,
    /const account = await getUserAccountInfo\(userId, caseId\)/,
  );
  assert.match(source, /const caseAccount = account\.casesAccounts\[0\]/);
  assert.match(
    source,
    /caseAccount\.termsBillingCode = await getTermsBillingCodeForGuestCase\(\s*caseId,\s*caseAccount,\s*\)/,
  );
  assert.match(source, /return NextResponse\.json\(account\)/);
});

test('guest shared-resource demo case terms are resolved from the owner case account', () => {
  const source = read('lib/accountInfo.ts');

  assert.match(source, /export async function getTermsBillingCodeForGuestCase/);
  assert.match(source, /caseAccount\?\.isGuest !== true/);
  assert.match(source, /return caseAccount\?\.billingCode/);
  assert.match(source, /SELECT TOP 1 c\.type, caseAccount/);
  assert.match(source, /JOIN caseAccount IN c\.casesAccounts/);
  assert.match(source, /caseAccount\.accountId = @caseId/);
  assert.match(source, /caseAccount\.isGuest != true/);
  assert.match(source, /ownerAccount\?\.type === 'SHARED_RESOURCES'/);
  assert.match(source, /ownerAccount\.caseAccount\?\.billingCode === 'D'/);
  assert.match(source, /return 'D'/);
  assert.match(source, /return caseAccount\.billingCode/);
});
