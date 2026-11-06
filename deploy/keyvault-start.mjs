import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** @param {string} directory @param {Record<string, string | undefined>} environment */
export async function loadKeyVaultSettings(directory, environment = process.env) {
  const names = (await readdir(directory)).filter(name => !name.startsWith('.'));
  if (!names.length) throw new Error('Key Vault mount contains no settings');
  for (const name of names) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error('Invalid setting filename in Key Vault mount');
    const value = await readFile(join(directory, name), 'utf8');
    if (!value) throw new Error(`Empty Key Vault setting ${name}`);
    environment[name] = value;
  }
  return names.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.env.KEY_VAULT_SECRETS_DIR) await loadKeyVaultSettings(process.env.KEY_VAULT_SECRETS_DIR);
  // Load the server only after settings are available to module initialization.
  await import(pathToFileURL(resolve(process.env.API_SERVER_PATH ?? './server.js')).href);
}
