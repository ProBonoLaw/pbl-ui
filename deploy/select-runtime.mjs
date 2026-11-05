import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { resolveRuntimeSettings, splitRuntimeSettings } from './runtime-settings.mjs';

const environment = process.env.DEPLOY_ENVIRONMENT;
if (!['Test', 'Production'].includes(environment)) throw new Error('Expected Test or Production');
const template = JSON.parse(await readFile(new URL(`./runtime/${environment.toLowerCase()}.json`, import.meta.url), 'utf8'));
const settings = resolveRuntimeSettings(template);
const { config } = splitRuntimeSettings(settings, process.env.KEY_VAULT_NAME);
if (process.env.RUNTIME_SETTINGS_PATH) await writeFile(process.env.RUNTIME_SETTINGS_PATH, JSON.stringify(settings), { mode: 0o600 });
if (process.env.GITHUB_ENV) {
  const names = ['NEXT_PUBLIC_AAD_TENANT_ID', 'NEXT_PUBLIC_AAD_CLIENT_ID', 'NEXT_PUBLIC_AAD_REDIRECT_URI',
    'NEXT_PUBLIC_AAD_API_SCOPE', 'NEXT_PUBLIC_AAD_ATTORNEY_EXTENSION', 'NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING'];
  for (const name of names) {
    const value = config[name] ?? '';
    if (/[\r\n]/.test(value)) throw new Error(`Invalid public build setting ${name}`);
    await appendFile(process.env.GITHUB_ENV, `${name}=${value}\n`);
  }
}
