import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await inspect(path);
    else {
      if (entry.name.startsWith('.env') || entry.name === '.npmrc' || entry.name.endsWith('.map')) {
        throw new Error(`Private or development artifact in static output: ${path}`);
      }
      if (/\.(js|json|html)$/.test(entry.name)) {
        const content = await readFile(path, 'utf8');
        if (/vault\.azure\.net\/secrets\/|-----BEGIN (?:RSA )?PRIVATE KEY-----|process\.env\.(?:COSMOS_SQL_KEY|AZURE_CLIENT_SECRET)/.test(content) ||
          content.includes('STATIC_BUILD_PRIVATE_SECRET_SENTINEL')) throw new Error(`Server configuration leaked into ${path}`);
      }
    }
  }
}
await inspect('out');
console.log('Static output contains public artifacts only');
