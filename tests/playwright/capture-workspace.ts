import { chromium, expect } from '@playwright/test';
import { installMockAuthRuntimeDependencies } from './fixtures/auth';

// Run against the local application with mock authentication configuration.
// Only mock API data is used. External requests are blocked.
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
  await page.route('https://**', route => route.abort());
  await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await installMockAuthRuntimeDependencies(page);
  const casesAccounts = ['Housing', 'Family', 'Employment'].map((name, index) => {
    const accountId = `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
    return {
      accountId, caseNumber: `DEMO-00${index + 1}`, agreedToCaseTerms: true,
      isGuest: false, canGenerateDeclaration: true, canUseQA: true, canAccessDocuments: true,
      record: {
        accountId, type: 'ACCOUNT_DETAILS', caseNumber: `DEMO-00${index + 1}`,
        personInformation: { firstName: 'Example', lastName: name, emailAddress: 'client@example.test' },
        filingRole: 'Plaintiff', state: 'WA', county: 'King',
        description: `${name} matter — fictional demonstration case`,
        opposition: { firstName: 'Sample', lastName: 'Party', filingRole: 'Defendant' },
      },
    };
  });
  await page.route('**/api/accounts/cases', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([{
      id: '00000000-0000-4000-8000-000000000100',
      emailAddresses: ['e2e.user@example.com'], oids: ['00000000-0000-4000-8000-000000000101'],
      casesAccounts, accountId: '00000000-0000-4000-8000-000000000102',
      agreedToTerms: true, isActive: true,
    }]),
  }));
  await page.goto(`${process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'}/cases`);
  try {
    await expect(page.getByRole('link', { name: 'View', exact: true })).toHaveCount(3, { timeout: 15000 });
  } catch (error) {
    await page.screenshot({ path: '/tmp/pbl-workspace-debug.png', fullPage: true });
    console.error(await page.locator('body').innerText());
    throw error;
  }
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'public/shared/case-workspace-example.png', fullPage: true, animations: 'disabled' });
} finally {
  await browser.close();
}
