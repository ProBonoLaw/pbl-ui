import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveRuntimeSettings, splitRuntimeSettings } from '../deploy/runtime-settings.mjs';

const hostSetting = { name: 'SHAREPOINT_HOST', valueFrom: 'SHAREPOINT_HOST' };
const scopesSetting = {
  name: 'AZURE_SHAREPOINT_READ_SCOPES',
  valueFrom: 'AZURE_SHAREPOINT_READ_SCOPES',
  optional: true,
};

test('deployment variables require a valid SharePoint host without leaking invalid values', () => {
  for (const host of [undefined, '', ' ', 'https://sharepoint.example.test',
    'sharepoint.example.test/sites/case', 'sharepoint.example.test:443',
    'user@sharepoint.example.test', 'sharepoint.example.test\nINJECTED=value']) {
    assert.throws(() => resolveRuntimeSettings([hostSetting], { SHAREPOINT_HOST: host }),
      /Missing deployment variable SHAREPOINT_HOST|Invalid deployment variable SHAREPOINT_HOST|SHAREPOINT_HOST must be a hostname/);
  }
  assert.deepEqual(resolveRuntimeSettings([hostSetting, scopesSetting], {
    SHAREPOINT_HOST: 'sharepoint.example.test',
  }), [
    { name: 'SHAREPOINT_HOST', value: 'sharepoint.example.test' },
    { name: 'AZURE_SHAREPOINT_READ_SCOPES', value: '' },
  ]);
  assert.throws(() => resolveRuntimeSettings([{ ...hostSetting, value: 'fallback' }]),
    /Invalid environment variable reference/);
});

test('variable resolution cannot bypass the plaintext credential policy', () => {
  for (const name of ['AZURE_CLIENT_SECRET', 'WEB_PUBSUB_CONNECTION_STRING']) {
    const resolved = resolveRuntimeSettings([
      { name, valueFrom: name },
    ], { [name]: 'test-only-secret' });
    assert.throws(() => splitRuntimeSettings(resolved, 'example-vault'),
      new RegExp(`Raw secret ${name}`));
  }
});

test('Web PubSub credentials remain in Key Vault and references use the deployment vault', () => {
  const declaration = { name: 'WEB_PUBSUB_CONNECTION_STRING', keyVaultSecret: true };
  const settings = resolveRuntimeSettings([declaration], {
    KEY_VAULT_NAME: 'example-vault',
    WEB_PUBSUB_CONNECTION_STRING: 'test-only-secret-that-must-not-be-read',
  });
  const { config, secrets } = splitRuntimeSettings(settings, 'example-vault');
  assert.equal(config.WEB_PUBSUB_CONNECTION_STRING, undefined);
  assert.deepEqual(secrets, [{
    name: 'WEB_PUBSUB_CONNECTION_STRING',
    secretName: 'probonolaw-ui-web-pubsub-connection-string',
    version: '',
    reference: '@Microsoft.KeyVault(SecretUri=https://example-vault.vault.azure.net/secrets/probonolaw-ui-web-pubsub-connection-string)',
  }]);
  assert.doesNotMatch(JSON.stringify(settings), /test-only-secret/);
  for (const vault of [undefined, '', 'https://example-vault', 'example-vault/path', 'example-vault\nINJECTED=value']) {
    assert.throws(() => resolveRuntimeSettings([declaration], { KEY_VAULT_NAME: vault }),
      /KEY_VAULT_NAME/);
  }
  for (const extra of [{ value: 'fallback' }, { valueFrom: 'WEB_PUBSUB_CONNECTION_STRING' }, { keyVaultSecret: false }]) {
    assert.throws(() => resolveRuntimeSettings([{ ...declaration, ...extra }]), /Invalid Key Vault secret declaration/);
  }
});

const telemetry = 'InstrumentationKey=00000000-0000-4000-8000-000000000001;IngestionEndpoint=https://telemetry.example.test/';
for (const environment of ['Test', 'Production']) {
  for (const connectionString of ['', telemetry]) {
    test(`${environment} exports only browser settings with telemetry ${connectionString ? 'configured' : 'unset'}`, async t => {
      const directory = await mkdtemp(join(tmpdir(), 'pb-law-runtime-'));
      t.after(() => rm(directory, { recursive: true, force: true }));
      const template = JSON.parse(await readFile(
        new URL(`../deploy/runtime/${environment.toLowerCase()}.json`, import.meta.url), 'utf8',
      ));
      const findSetting = (name: string) => template.find((setting: { name: string }) => setting.name === name);
      assert.deepEqual(findSetting('NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING'), {
        name: 'NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING',
        valueFrom: 'NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING',
        optional: true,
      });
      assert.deepEqual(findSetting('WEB_PUBSUB_CONNECTION_STRING'), {
        name: 'WEB_PUBSUB_CONNECTION_STRING', keyVaultSecret: true,
      });
      assert.doesNotMatch(JSON.stringify(template), /vault\.azure\.net|InstrumentationKey=/);
      const vaultName = 'example-vault';
      const runtimePath = join(directory, 'runtime.json');
      const publicPath = join(directory, 'public.env');
      const scopes = 'https://sharepoint.example.test/AllSites.Read,https://sharepoint.example.test/Sites.Search.All';
      const result = spawnSync('node', ['deploy/select-runtime.mjs'], {
        encoding: 'utf8',
        env: {
          ...Object.fromEntries(template
            .filter((setting: { valueFrom?: string; optional?: boolean }) => setting.valueFrom && !setting.optional)
            .map((setting: { valueFrom: string }) => [setting.valueFrom, 'example-value'])),
          NODE_ENV: 'test',
          PATH: process.env.PATH,
          DEPLOY_ENVIRONMENT: environment,
          KEY_VAULT_NAME: vaultName,
          SHAREPOINT_HOST: 'sharepoint.example.test',
          AZURE_SHAREPOINT_READ_SCOPES: scopes,
          NEXT_PUBLIC_SUPPORT_EMAIL: 'requests+ci@example.test',
          ...(connectionString ? { NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING: connectionString } : {}),
          RUNTIME_SETTINGS_PATH: runtimePath,
          GITHUB_ENV: publicPath,
        },
      });
      assert.equal(result.status, 0, result.stderr);
      const settings = JSON.parse(await readFile(runtimePath, 'utf8'));
      const { config, secrets } = splitRuntimeSettings(settings, vaultName);
      assert.equal(config.SHAREPOINT_HOST, 'sharepoint.example.test');
      assert.equal(config.AZURE_SHAREPOINT_READ_SCOPES, scopes);
      assert.equal(config.NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING, connectionString);
      assert.equal(config.NEXT_PUBLIC_SUPPORT_EMAIL, 'requests+ci@example.test');
      assert.equal(config.WEB_PUBSUB_CONNECTION_STRING, undefined);
      assert.ok(secrets.some((secret: { name: string }) => secret.name === 'WEB_PUBSUB_CONNECTION_STRING'));
      assert.ok(settings.every((setting: object) => !Object.hasOwn(setting, 'valueFrom') && !Object.hasOwn(setting, 'keyVaultSecret')));
      const publicSettings = await readFile(publicPath, 'utf8');
      assert.match(publicSettings, /NEXT_PUBLIC_AAD_CLIENT_ID=/);
      assert.ok(publicSettings.split('\n').includes('NEXT_PUBLIC_SUPPORT_EMAIL=requests+ci@example.test'));
      assert.ok(publicSettings.split('\n').includes(`NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING=${connectionString}`));
      assert.doesNotMatch(publicSettings, /SHAREPOINT|sharepoint\.example\.test|WEB_PUBSUB|vault\.azure\.net/);
    });
  }
}
