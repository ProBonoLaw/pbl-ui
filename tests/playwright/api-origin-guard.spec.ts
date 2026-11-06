import { expect, test } from '@playwright/test';

const apiBase = process.env.PLAYWRIGHT_API_BASE_URL;
test.skip(!apiBase, 'Set PLAYWRIGHT_API_BASE_URL to test the private API origin directly');

test('API origin rejects missing and foreign Front Door profiles', async ({ request }) => {
  const attempts: Record<string, string>[] = [{}, { 'X-Azure-FDID': 'foreign-profile' }];
  for (const headers of attempts) {
    const response = await request.get(`${apiBase}/api/accounts/terms`, { headers });
    expect(response.status()).toBe(403);
  }
});

test('the correct Front Door profile still requires application authentication', async ({ request }) => {
  const response = await request.get(`${apiBase}/api/accounts/terms`, {
    headers: { 'X-Azure-FDID': process.env.AZURE_FRONT_DOOR_ID! },
  });
  expect(response.status()).toBe(401);
});

test('API origin serves health probes and excludes UI pages', async ({ request }) => {
  expect((await request.head(`${apiBase}/api/health`)).status()).toBe(200);
  expect((await request.get(`${apiBase}/cases/arbitrary-case-id`)).status()).toBe(404);
});
