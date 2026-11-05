import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export function resolveEventHubsImportEntry(sdkPackage, packagePath) {
  const importExport = sdkPackage.exports?.['.']?.import;
  const entry = typeof importExport === 'string' ? importExport : importExport?.default;
  if (typeof entry !== 'string' || !entry.startsWith('./')) {
    throw new Error('Packaged Event Hubs SDK has no runnable ESM import export');
  }
  return pathToFileURL(resolve(dirname(packagePath), entry)).href;
}

export async function loadPackagedEventHubs(directory = 'build/standalone') {
  const standalone = resolve(directory);
  const require = createRequire(resolve(standalone, 'server.js'));
  // Resolve from the packaged server, without falling back to development modules.
  for (const name of ['@azure/event-hubs/package.json', 'rhea']) {
    if (!require.resolve(name).startsWith(standalone + sep + 'node_modules' + sep)) {
      throw new Error(`${name} is missing from the standalone API package`);
    }
  }

  // The server imports the SDK's ESM entry; standalone tracing copies that entry.
  const packagePath = require.resolve('@azure/event-hubs/package.json');
  const sdkPackage = JSON.parse(await readFile(packagePath, 'utf8'));
  const sdk = await import(resolveEventHubsImportEntry(sdkPackage, packagePath));
  const rhea = require('rhea');
  // Exercise the inherited container method that failed in bundled API routes.
  // Creating a connection object does not open a socket or publish an event.
  const connection = rhea.create_connection({});
  if (connection.get_option('standalone_verification', 'verified') !== 'verified') {
    throw new Error('Event Hubs AMQP container option inheritance is broken');
  }
  if (typeof sdk.EventHubProducerClient !== 'function') {
    throw new Error('Event Hubs producer is missing from the standalone API package');
  }
  return sdk;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await loadPackagedEventHubs();
  console.log('Standalone Event Hubs SDK and AMQP container verified');
}
