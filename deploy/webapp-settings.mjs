import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { splitRuntimeSettings } from './runtime-settings.mjs';

export function webAppSettings(runtimeSettings, environment) {
  const { secrets } = splitRuntimeSettings(runtimeSettings, environment.KEY_VAULT_NAME);
  if (!/^[a-z0-9.-]+\.pem$/i.test(environment.INTERNAL_CA_CERT_NAME || '')) {
    throw new Error('INTERNAL_CA_CERT_NAME must be a PEM filename');
  }
  const settings = {
    LEGAL_DOCUMENT_ARCHIVE_PATH: 'archives/TermsAndAgreements.zip',
    NODE_EXTRA_CA_CERTS: '/home/site/wwwroot/certs/' + environment.INTERNAL_CA_CERT_NAME,
    SCM_DO_BUILD_DURING_DEPLOYMENT: 'false',
    ...Object.fromEntries(secrets.map(secret => [secret.name, secret.reference])),
  };
  for (const name of [
    'NEXT_PUBLIC_AAD_TENANT_ID', 'NEXT_PUBLIC_AAD_CLIENT_ID',
    'NEXT_PUBLIC_AAD_REDIRECT_URI', 'NEXT_PUBLIC_AAD_API_SCOPE',
    'NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING',
  ]) settings[name] = environment[name] || '';
  return settings;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const settings = JSON.parse(await readFile(process.env.RUNTIME_SETTINGS_PATH, 'utf8'));
  process.stdout.write(JSON.stringify(webAppSettings(settings, process.env)));
}
