import { expect, test } from '@playwright/test';

test('API proxy preserves request bodies larger than the Next.js default buffer', async ({ request }) => {
  // The local API compiles its Azure dependencies on the first request.
  test.setTimeout(90_000);
  const response = await request.post('/api/newsletter', {
    data: { padding: 'x'.repeat(11_000_000), firstName: 'Local', lastName: 'Test', email: 'invalid' },
  });
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: 'A valid email is required' });
});

test('Front Door can probe the API with HEAD without application credentials', async ({ request }) => {
  const response = await request.head('/api/health');
  expect(response.status()).toBe(200);
  expect(await response.body()).toHaveLength(0);
  expect(response.headers()['cache-control']).toBe('no-store');
});

test('API health reports readiness without caching the response', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
  expect(response.headers()['cache-control']).toBe('no-store');
});
