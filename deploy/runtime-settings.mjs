import { readFileSync } from 'node:fs';

const policy = JSON.parse(readFileSync(new URL('./secret-policy.json', import.meta.url), 'utf8'));
const namePattern = new RegExp(policy.namePattern, 'i');
const valuePattern = new RegExp(policy.valuePattern, 'i');
const vaultNamePattern = /^[a-z][a-z0-9-]{1,22}[a-z0-9]$/i;

// GitHub environment variables supply deployment identifiers without committing
// their values. Resolve these before writing the temporary runtime settings.
/**
 * @param {Array<{name: string, value?: string, valueFrom?: string, optional?: boolean, keyVaultSecret?: boolean}>} settings
 * @param {Record<string, string | undefined>} environment
 */
export function resolveRuntimeSettings(settings, environment = process.env) {
  return settings.map(setting => {
    if (Object.hasOwn(setting, 'keyVaultSecret')) {
      const { name } = setting;
      if (setting.keyVaultSecret !== true || !/^[A-Z_][A-Z0-9_]*$/.test(name) ||
        Object.hasOwn(setting, 'value') || Object.hasOwn(setting, 'valueFrom')) {
        throw new Error(`Invalid Key Vault secret declaration for ${name}`);
      }
      const vaultName = environment.KEY_VAULT_NAME;
      if (typeof vaultName !== 'string' || !vaultNamePattern.test(vaultName)) {
        throw new Error('KEY_VAULT_NAME is required and must be a valid vault name');
      }
      const secretName = policy.secretPrefix + name.toLowerCase().replaceAll('_', '-');
      return { name, value: `@Microsoft.KeyVault(SecretUri=https://${vaultName}.vault.azure.net/secrets/${secretName})` };
    }
    if (!Object.hasOwn(setting, 'valueFrom')) return setting;
    const { name, valueFrom, optional } = setting;
    if (Object.hasOwn(setting, 'value') || typeof valueFrom !== 'string' || !/^[A-Z_][A-Z0-9_]*$/.test(valueFrom)) {
      throw new Error(`Invalid environment variable reference for ${name}`);
    }
    const value = environment[valueFrom] ?? '';
    if (typeof value !== 'string' || /[\r\n]/.test(value)) {
      throw new Error(`Invalid deployment variable ${valueFrom}`);
    }
    if (!value.trim() && optional !== true) {
      throw new Error(`Missing deployment variable ${valueFrom}`);
    }
    if (name === 'SHAREPOINT_HOST' && (
      value.length > 253 ||
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(value)
    )) {
      throw new Error('SHAREPOINT_HOST must be a hostname without a scheme, path, or port');
    }
    return { name, value };
  });
}

export function isSensitive(name, value) {
  // This telemetry identifier is deliberately included in the browser bundle.
  if (name === 'NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING') return false;
  return namePattern.test(name) || valuePattern.test(value);
}

export function splitRuntimeSettings(settings, vaultName) {
  if (typeof vaultName !== 'string' || !vaultNamePattern.test(vaultName)) throw new Error('KEY_VAULT_NAME is required');
  /** @type {Record<string, string>} */
  const config = {};
  const secrets = [];
  for (const { name, value } of settings) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || typeof value !== 'string') {
      throw new Error('Expected named string App Service settings');
    }
    if (value.startsWith('@Microsoft.KeyVault(')) {
      const reference = value.match(/^@Microsoft\.KeyVault\(SecretUri=https:\/\/([a-z0-9-]+)\.vault\.azure\.net\/secrets\/([a-z0-9-]+)(?:\/([a-f0-9]+))?\/?\)$/i);
      const secretName = policy.secretPrefix + name.toLowerCase().replaceAll('_', '-');
      if (!reference || reference[1] !== vaultName || reference[2] !== secretName) {
        throw new Error(`Unexpected Key Vault reference for ${name}; run configure-keyvault.py`);
      }
      secrets.push({ name, secretName, version: reference[3] || '', reference: value });
    } else if (isSensitive(name, value) && value) {
      throw new Error(`Raw secret ${name} is forbidden in releases; run deploy/azure/configure-keyvault.py`);
    } else {
      config[name] = value;
    }
  }
  if (!secrets.length) throw new Error('No Key Vault references found; run configure-keyvault.py');
  return { config, secrets };
}
