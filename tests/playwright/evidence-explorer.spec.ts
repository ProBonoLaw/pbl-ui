import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { installMockAuthRuntimeDependencies } from './fixtures/auth';

const caseId = '00000000-0000-4000-8000-000000001000';

test('filters and renders case evidence', async ({ page }) => {
  test.setTimeout(60_000);
  await installMockAuthRuntimeDependencies(page);

  await page.route(`**/api/accounts/cases/${caseId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: caseId,
        agreedToTerms: true,
        isActive: true,
        casesAccounts: [
          {
            accountId: caseId,
            caseNumber: 'E2E-001',
            agreedToCaseTerms: true,
            isGuest: false,
            canAccessDocuments: true,
          },
        ],
      }),
    }),
  );
  await page.route('**/api/accounts/feedback-requests', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );

  await page.route(
    `**/api/accounts/cases/${caseId}/evidence/search/values`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            accountId: caseId,
            tags: ['claim', 'fact', 'event', 'contract'],
            who: [
              ...Array.from({ length: 5000 }, (_, index) => `Person ${index + 1}`),
              'Jordan Lee',
              'Avery Quinn',
            ],
            where: [
              ...Array.from({ length: 5000 }, (_, index) => `Location ${index + 1}`),
              'King County',
            ],
          },
        }),
      }),
  );

  let searchRequest: Record<string, unknown> | undefined;
  const source = `https://sharepoint.example.test/:b:/s/${caseId}/sharing-token`;
  let previewSource: string | null = null;
  await page.route(`**/api/accounts/cases/${caseId}/sharepoint-proxy?*`, async (route) => {
    previewSource = new URL(route.request().url()).searchParams.get('url');
    await route.fulfill({ json: { previewUrl: 'https://preview.example.test/document' } });
  });
  await page.route('https://preview.example.test/document', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html lang="en"><head><title>Source document preview</title></head><body><main><p>Source document preview</p></main></body></html>',
    }),
  );
  await page.route(
    `**/api/accounts/cases/${caseId}/evidence/search`,
    async (route) => {
      searchRequest = route.request().postDataJSON() as Record<string, unknown>;
      const skip = searchRequest.skip as number;
      const families = searchRequest.families as string[];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            accountId: caseId,
            query: 'notice',
            tags: [...families, 'contract'],
            who: ['Jordan Lee'],
            where: ['King County'],
            top: 20,
            skip,
            totalCount: searchRequest.query === 'large result set' ? 100040 : 41,
            results: Array.from({ length: 20 }, (_, index) => {
              const resultIndex = skip + index;
              const asOfDates = [
                { year: '2024', month: '10', day: '15', season: null, quarter: null },
                null,
                { year: '2018', month: '03' },
                { year: '2023', quarter: 'Q2' },
                { year: '2022', season: 'Spring' },
                { year: '2020' },
                { year: null, month: null, day: null, season: null, quarter: null },
              ];
              const whyValues = [
                'Recorded in the case evidence.',
                null,
                'Unknown',
                '   ',
                ' unknown ',
                'Unknown cause documented in the case evidence.',
              ];
              return {
                tags: [...families, 'contract'],
                who: ['Jordan Lee'],
                whenStarted: resultIndex === 0
                  ? { year: '2024', month: '03', day: '3', season: null, quarter: null }
                  : resultIndex === 2
                    ? JSON.stringify({ year: '2018', month: '03', day: '15', season: null, quarter: null })
                    : JSON.stringify({ year: null, month: null, day: null, season: null, quarter: null }),
                whenEnded: null,
                asOf: asOfDates[resultIndex] ?? null,
                what:
                  resultIndex === 0
                    ? 'A material fact in the case'
                    : `Case fact ${resultIndex + 1}`,
                where: 'King County',
                why: resultIndex < whyValues.length
                  ? whyValues[resultIndex]
                  : 'Recorded in the case evidence.',
                sourceId: `source-${resultIndex + 1}`,
                source,
                pages: [3],
              };
            }),
          },
        }),
      });
    },
  );

  await page.goto(`/cases/${caseId}/evidence`);
  await expect(
    page.getByRole('main').getByRole('heading', {
      name: 'Evidence Explorer',
    }),
  ).toBeVisible();

  for (const width of [1920, 1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await page.getByLabel('Page content').locator('form').evaluate((form) => {
      const content = form.parentElement!.parentElement!;
      const formBounds = form.getBoundingClientRect();
      const contentBounds = content.getBoundingClientRect();
      const contentStyle = getComputedStyle(content);
      return {
        left: formBounds.left,
        right: formBounds.right,
        expectedLeft: contentBounds.left + Number.parseFloat(contentStyle.paddingLeft),
        expectedRight: contentBounds.right - Number.parseFloat(contentStyle.paddingRight),
        padding: getComputedStyle(form).padding,
      };
    });
    expect(layout.left).toBeCloseTo(layout.expectedLeft, 0);
    expect(layout.right).toBeCloseTo(layout.expectedRight, 0);
    expect(layout.padding).toBe('20px');
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  const claims = page.getByRole('button', { name: 'Claims', exact: true });
  const facts = page.getByRole('button', { name: 'Facts', exact: true });
  const events = page.getByRole('button', { name: 'Events', exact: true });
  const search = page.getByRole('button', { name: 'Search evidence' });
  await expect(claims).toHaveAttribute('aria-pressed', 'true');
  await facts.click();
  await expect(claims).toHaveAttribute('aria-pressed', 'true');
  await expect(facts).toHaveAttribute('aria-pressed', 'true');
  await events.click();
  await expect(events).toHaveAttribute('aria-pressed', 'true');
  await claims.click();
  await facts.click();
  await events.click();
  await expect(search).toBeDisabled();
  await facts.focus();
  await page.keyboard.press('Space');
  await expect(facts).toHaveAttribute('aria-pressed', 'true');
  await expect(search).toBeEnabled();
  await page.getByRole('combobox', { name: 'Additional tags (all must match)' }).fill('contract');
  await page.getByRole('option', { name: 'contract', exact: true }).click();
  await page.getByRole('combobox', { name: 'Who (any may match)' }).fill('Jordan');
  await page.getByRole('option', { name: 'Jordan Lee', exact: true }).click();
  await page.getByRole('combobox', { name: 'Where' }).fill('King County');
  await page.getByRole('option', { name: 'King County', exact: true }).click();
  await page.getByLabel('Search terms').fill('notice');
  await page.getByRole('button', { name: 'Search evidence' }).click();

  await expect(page.getByRole('heading', { name: 'A material fact in the case', exact: true })).toBeVisible();
  const content = page.getByRole('region', { name: 'Page content', exact: true });
  for (const viewport of [
    { width: 2397, height: 1325 },
    { width: 1280, height: 700 },
    { width: 390, height: 700 },
  ]) {
    await page.setViewportSize(viewport);
    await expect.poll(() => page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }))).toEqual({ scrollHeight: viewport.height, clientHeight: viewport.height });
    const heading = page.getByRole('heading', { name: 'Evidence Explorer', exact: true });
    const headingTop = (await heading.boundingBox())!.y;
    await expect.poll(() => content.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    await content.evaluate((element) => element.scrollTo(0, element.scrollHeight));
    await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    expect((await heading.boundingBox())!.y).toBe(headingTop);
    await content.evaluate((element) => element.scrollTo(0, 0));
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  const firstResult = page.getByRole('article').first();
  await expect(firstResult.locator('p')).toHaveText('Recorded in the case evidence.');
  for (const index of [1, 2, 3, 4]) {
    const result = page.getByRole('article').nth(index);
    await expect(result.getByRole('heading', { name: `Case fact ${index + 1}`, exact: true })).toBeVisible();
    await expect(result.locator('p')).toHaveCount(0);
  }
  await expect(page.getByRole('article').nth(5).locator('p')).toHaveText(
    'Unknown cause documented in the case evidence.',
  );
  await expect(firstResult.getByText('March 3, 2024')).toBeVisible();
  await expect(page.getByRole('article').nth(1).getByText('Not available')).toBeVisible();
  await expect(page.getByRole('article').nth(2).getByText('March 15, 2018')).toBeVisible();
  await expect(page.getByRole('article').getByText(/\{"year":/)).toHaveCount(0);
  await expect(firstResult.getByRole('term').filter({ hasText: /^As of$/ })).toBeVisible();
  await expect(firstResult.getByText('October 15, 2024', { exact: true })).toBeVisible();
  await expect(page.getByRole('article').nth(1).getByRole('term').filter({ hasText: /^As of$/ })).toHaveCount(0);
  for (const [index, date] of [
    [2, 'March 2018'],
    [3, 'Q2 2023'],
    [4, 'Spring 2022'],
    [5, '2020'],
  ] as const) {
    await expect(page.getByRole('article').nth(index).getByText(date, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('article').nth(6).getByRole('term').filter({ hasText: /^As of$/ })).toHaveCount(0);
  const sourceButton = firstResult.getByRole('button', {
    name: 'View source for A material fact in the case', exact: true,
  });
  const previewTitle = 'Source preview for A material fact in the case';
  const preview = firstResult.getByRole('region', { name: previewTitle, includeHidden: true });
  const previewId = await preview.getAttribute('id');
  await expect(sourceButton).toHaveAttribute('aria-controls', previewId!);
  await expect(sourceButton).toHaveAttribute('aria-expanded', 'false');
  await expect(preview).toBeHidden();
  await expect(firstResult.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('article').nth(1).getByRole('button', {
    name: 'View source for Case fact 2', exact: true,
  })).not.toHaveAttribute('aria-controls', previewId!);
  const sourceTarget = await sourceButton.boundingBox();
  expect(sourceTarget?.height).toBeGreaterThanOrEqual(44);
  expect(sourceTarget?.width).toBeGreaterThanOrEqual(44);
  await sourceButton.hover();
  await expect(sourceButton).toHaveCSS('cursor', 'pointer');
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await sourceButton.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(sourceButton).toBeFocused();
    await expect(sourceButton).toHaveCSS('outline-style', 'solid');
    await expect(sourceButton).toHaveCSS('outline-width', '2px');
    const collapsedScan = await new AxeBuilder({ page })
      .include('article')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(collapsedScan.violations).toEqual([]);
    await page.keyboard.press('Enter');
    const hideSourceButton = firstResult.getByRole('button', {
      name: 'Hide source preview for A material fact in the case', exact: true,
    });
    await expect(hideSourceButton).toBeFocused();
    await expect(hideSourceButton).toHaveAttribute('aria-expanded', 'true');
    await expect(preview).toBeVisible();
    await expect.poll(() => previewSource).toBe(source);
    await expect(firstResult.locator('iframe')).toHaveAttribute('src', 'https://preview.example.test/document');
    await expect(firstResult.locator('iframe')).toHaveAttribute('title', previewTitle);
    const expandedScan = await new AxeBuilder({ page })
      .include('article')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(expandedScan.violations).toEqual([]);
    await page.keyboard.press('Space');
    await expect(sourceButton).toBeFocused();
    await expect(sourceButton).toHaveAttribute('aria-expanded', 'false');
    await expect(preview).toBeHidden();
    await expect(firstResult.locator('iframe')).toHaveCount(0);
  }
  await expect.poll(() => searchRequest).toMatchObject({
    families: ['fact'],
    query: 'notice',
    tags: ['contract'],
    who: ['Jordan Lee'],
    where: 'King County',
  });
  await page.getByLabel('Search terms').fill('edited query');
  await events.click();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByRole('heading', { name: 'Case fact 21', exact: true })).toBeVisible();
  await expect.poll(() => searchRequest).toMatchObject({
    families: ['fact'], query: 'notice', skip: 20,
  });
  await search.click();
  await expect.poll(() => searchRequest).toMatchObject({
    families: ['fact', 'event'],
    query: 'edited query',
    skip: 0,
  });
  await expect(page.getByRole('heading', { name: 'A material fact in the case', exact: true })).toBeVisible();
  await expect(page.getByRole('article').first().getByText('fact', { exact: true })).toBeVisible();
  await expect(page.getByRole('article').first().getByText('event', { exact: true })).toBeVisible();
  await claims.click();
  await search.click();
  await expect.poll(() => searchRequest).toMatchObject({
    families: ['claim', 'fact', 'event'],
    skip: 0,
  });
  await page.getByLabel('Search terms').fill('large result set');
  await search.click();
  await expect(page.getByText('100040 matches', { exact: true })).toBeVisible();
  await expect(page.getByText(/You can browse up to 100,020 matching results/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Page 5002', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Page 5001', exact: true }).click();
  await expect.poll(() => searchRequest).toMatchObject({ skip: 100000 });
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Page 5002', exact: true })).toHaveCount(0);
  await expect(page.getByText('100040 matches', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 700 });
  await expect(page.getByRole('button', { name: 'Next page' }).filter({ visible: true })).toBeDisabled();
});
