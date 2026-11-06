import { expect, test, type Page } from '@playwright/test';
import { buildSync } from 'esbuild';
import { join } from 'node:path';

const bundle = buildSync({
  entryPoints: [join(process.cwd(), 'tests/playwright/fixtures/navigation.tsx')],
  bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
}).outputFiles[0].text;

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);
async function scrollTo(page: Page, top: number) {
  await page.evaluate((value) => window.scrollTo(0, value), top);
  await expect.poll(() => scrollY(page)).toBe(top);
  // The browser records the position through a scroll event before navigation.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

test.beforeEach(async ({ page }) => {
  await page.route('**/navigation-test/**', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><div id="root"></div><script src="/navigation-fixture.js"></script>',
  }));
  await page.route('**/navigation-fixture.js', (route) => route.fulfill({ contentType: 'application/javascript', body: bundle }));
  await page.goto('/navigation-test/start');
  await expect(page.getByRole('heading', { name: 'Navigation fixture' })).toBeVisible();
});

test('normal navigation resets scroll and Back/Forward restore each entry', async ({ page }) => {
  await scrollTo(page, 650);
  await page.getByRole('link', { name: 'Normal link', exact: true }).click();
  await expect(page).toHaveURL('/navigation-test/one');
  await expect.poll(() => scrollY(page)).toBe(0);
  await scrollTo(page, 350);
  await page.goBack();
  await expect.poll(() => scrollY(page)).toBe(650);
  await page.goForward();
  await expect.poll(() => scrollY(page)).toBe(350);
});

test('links and imperative navigation honor scroll false', async ({ page }) => {
  await scrollTo(page, 625);
  for (const [role, name, path] of [
    ['link', 'Preserve link', '/navigation-test/two'],
    ['button', 'Preserve push', '/navigation-test/three'],
    ['button', 'Preserve replace', '/navigation-test/four'],
  ] as const) {
    await page.getByRole(role, { name, exact: true }).click();
    await expect(page).toHaveURL(path);
    await expect.poll(() => scrollY(page)).toBe(625);
  }
});

test('hash navigation finds its target and scroll false preserves the offset', async ({ page }) => {
  await page.goto('/navigation-test/start?view=details');
  await page.getByRole('link', { name: 'Hash link', exact: true }).click();
  await expect(page).toHaveURL('/navigation-test/start?view=details#target');
  await expect.poll(() => scrollY(page)).toBe(1800);
  await page.goBack();
  await expect.poll(() => scrollY(page)).toBe(0);
  await scrollTo(page, 100);
  await page.getByRole('link', { name: 'Preserve hash', exact: true }).click();
  await expect(page).toHaveURL('/navigation-test/start?view=details#target');
  await expect.poll(() => scrollY(page)).toBe(100);
  await page.goBack();
  await page.getByRole('button', { name: 'Preserve push hash', exact: true }).click();
  await expect(page).toHaveURL('/navigation-test/start?view=details#target');
  await expect.poll(() => scrollY(page)).toBe(100);
});

test('hash targets and Back restoration wait for delayed page content', async ({ page }) => {
  await page.getByRole('link', { name: 'Delayed hash', exact: true }).click();
  await expect.poll(() => scrollY(page)).toBe(1800);
  await scrollTo(page, 2200);
  await page.getByRole('link', { name: 'Normal link', exact: true }).click();
  await expect.poll(() => scrollY(page)).toBe(0);
  await page.goBack();
  await expect.poll(() => scrollY(page)).toBe(2200);
});
