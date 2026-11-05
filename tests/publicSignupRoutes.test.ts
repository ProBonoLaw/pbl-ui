import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf-8');
}

test('beta-tester route validates required fields, email, and consent', () => {
  const source = read('app/api/beta-tester/route.ts');

  assert.match(
    source,
    /if \(!firstName \|\| !lastName \|\| !email\)[\s\S]*firstName, lastName, and email are required[\s\S]*status:\s*400/,
  );
  assert.match(
    source,
    /if \(!isValidEmail\(email\)\)[\s\S]*A valid email is required[\s\S]*status:\s*400/,
  );
  assert.match(
    source,
    /if \(!consent\)[\s\S]*consent must be true[\s\S]*status:\s*400/,
  );
});

test('newsletter route validates required fields, email, and consent', () => {
  const source = read('app/api/newsletter/route.ts');

  assert.match(
    source,
    /if \(!firstName \|\| !lastName \|\| !email\)[\s\S]*firstName, lastName, and email are required[\s\S]*status:\s*400/,
  );
  assert.match(
    source,
    /if \(!isValidEmail\(email\)\)[\s\S]*A valid email is required[\s\S]*status:\s*400/,
  );
  assert.match(
    source,
    /if \(!consent\)[\s\S]*consent must be true[\s\S]*status:\s*400/,
  );
});

test('beta-tester route requires STORAGE_ACCOUNT_NAME and uses beta table env default', () => {
  const source = read('app/api/beta-tester/route.ts');

  assert.match(source, /process\.env\.STORAGE_ACCOUNT_NAME/);
  assert.match(
    source,
    /process\.env\.BETA_TESTER_TABLE_NAME\s*\|\|\s*DEFAULT_BETA_TESTER_TABLE_NAME/,
  );
  assert.match(
    source,
    /if \(!accountName\)[\s\S]*Server misconfiguration[\s\S]*status:\s*500/,
  );
});

test('newsletter route requires STORAGE_ACCOUNT_NAME and uses newsletter table env default', () => {
  const source = read('app/api/newsletter/route.ts');

  assert.match(source, /process\.env\.STORAGE_ACCOUNT_NAME/);
  assert.match(
    source,
    /process\.env\.NEWSLETTER_TABLE_NAME\s*\|\|\s*DEFAULT_NEWSLETTER_TABLE_NAME/,
  );
  assert.match(
    source,
    /if \(!accountName\)[\s\S]*Server misconfiguration[\s\S]*status:\s*500/,
  );
});

test('beta-tester route persists signups to Azure Table with expected metadata', () => {
  const source = read('app/api/beta-tester/route.ts');

  assert.match(
    source,
    /new TableClient\([\s\S]*`https:\/\/\$\{accountName\}\.table\.core\.windows\.net`[\s\S]*new DefaultAzureCredential\(\)/,
  );
  assert.match(source, /partitionKey:\s*BETA_TESTER_PARTITION_KEY/);
  assert.match(source, /consent:\s*true/);
  assert.match(source, /source:\s*'website'/);
  assert.match(source, /return NextResponse\.json\(\{ ok: true \}, \{ status: 201 \}\)/);
});

test('newsletter route persists signups to Azure Table with expected metadata', () => {
  const source = read('app/api/newsletter/route.ts');

  assert.match(
    source,
    /new TableClient\([\s\S]*`https:\/\/\$\{accountName\}\.table\.core\.windows\.net`[\s\S]*new DefaultAzureCredential\(\)/,
  );
  assert.match(source, /partitionKey:\s*NEWSLETTER_PARTITION_KEY/);
  assert.match(source, /consent:\s*true/);
  assert.match(source, /source:\s*'website'/);
  assert.match(source, /return NextResponse\.json\(\{ ok: true \}, \{ status: 201 \}\)/);
});
