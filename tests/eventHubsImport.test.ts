import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveEventHubsImportEntry } from '../deploy/verify-event-hubs.mjs';

const packagePath = resolve('build/standalone/node_modules/@azure/event-hubs/package.json');
const expectedEntry = pathToFileURL(
  resolve('build/standalone/node_modules/@azure/event-hubs/dist/esm/index.js'),
).href;

test('resolves a direct Event Hubs ESM export string', () => {
  const sdkPackage = { exports: { '.': { import: './dist/esm/index.js' } } };
  assert.equal(resolveEventHubsImportEntry(sdkPackage, packagePath), expectedEntry);
});

test('resolves a conditional ESM default export instead of its TypeScript declaration', () => {
  const sdkPackage = {
    exports: {
      '.': {
        import: { types: './dist/esm/index.d.ts', default: './dist/esm/index.js' },
      },
    },
  };
  assert.equal(resolveEventHubsImportEntry(sdkPackage, packagePath), expectedEntry);
});

test('rejects a package without a runnable ESM import export', () => {
  for (const sdkPackage of [{}, { exports: { '.': { import: { types: './index.d.ts' } } } }]) {
    assert.throws(
      () => resolveEventHubsImportEntry(sdkPackage, packagePath),
      /no runnable ESM import export/,
    );
  }
});
