import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { splitRuntimeSettings } from './runtime-settings.mjs';

function az(args) {
  const result = spawnSync('az', [...args, '--only-show-errors', '--output', 'json'], { encoding: 'utf8' });
  // Appsettings list can contain credentials before migration. Never echo CLI output.
  if (result.status !== 0) throw new Error('Azure Key Vault reference verification request failed');
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}

export function resolvedReferences(response, secrets) {
  const records = response.value
    ? Object.fromEntries(response.value.map(item => [item.name, item.properties]))
    : response.properties || {};
  for (const secret of secrets) {
    const record = records[secret.name];
    if (record?.status !== 'Resolved') {
      throw new Error(`Key Vault reference ${secret.name}: ${record?.status || 'missing resolution status'}`);
    }
  }
  return secrets.map(secret => secret.name);
}

export async function verifyKeyVault(environment = process.env) {
  const subscription = environment.AZURE_SUBSCRIPTION_ID;
  const group = environment.WEBAPP_RESOURCE_GROUP;
  const app = environment.WEBAPP_NAME;
  if (![subscription, group, app].every(value => /^[a-z0-9-]+$/i.test(value || ''))) {
    throw new Error('Azure subscription, Web App name and resource group are required');
  }
  const settings = az(['webapp', 'config', 'appsettings', 'list', '-g', group, '-n', app, '--subscription', subscription]);
  const { secrets } = splitRuntimeSettings(settings, environment.KEY_VAULT_NAME);
  const endpoint = `https://management.azure.com/subscriptions/${subscription}/resourceGroups/${group}/providers/Microsoft.Web/sites/${app}/config/configreferences/appsettings`;
  // Appsettings changes restart App Service; refresh may briefly return 409.
  for (let attempt = 0; ; attempt++) {
    try {
      az(['rest', '--method', 'post', '--url', endpoint + '/refresh?api-version=2022-03-01']);
      break;
    } catch (error) {
      if (attempt === 17) throw error;
      console.log('Waiting for App Service to accept Key Vault reference refresh');
      await new Promise(done => setTimeout(done, 10000));
    }
  }
  for (let attempt = 0; attempt < 18; attempt++) {
    const response = az(['rest', '--method', 'get', '--url', endpoint + '?api-version=2022-03-01']);
    try {
      const names = resolvedReferences(response, secrets);
      console.log(`Verified ${secrets.length} resolved Key Vault references for ${app}`);
      return names;
    } catch (error) {
      if (attempt === 17) throw error;
      console.log(error.message + '; waiting for identity/network propagation');
      await new Promise(done => setTimeout(done, 10000));
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await verifyKeyVault();
}
