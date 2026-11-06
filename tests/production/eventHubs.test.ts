import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPackagedEventHubs } from '../../deploy/verify-event-hubs.mjs';

test('standalone verification rejects SDK resolution from development dependencies', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'pb-law-event-hubs-package-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const standalone = join(directory, 'build/standalone');
  const developmentSdk = join(directory, 'node_modules/@azure/event-hubs');
  await mkdir(standalone, { recursive: true });
  await mkdir(developmentSdk, { recursive: true });
  await writeFile(join(standalone, 'server.js'), '');
  await writeFile(join(developmentSdk, 'package.json'), JSON.stringify({
    name: '@azure/event-hubs',
    exports: { './package.json': './package.json' },
  }));
  await assert.rejects(
    loadPackagedEventHubs(standalone),
    /@azure\/event-hubs\/package.json is missing from the standalone API package/,
  );
});

test('the packaged Event Hubs sender reaches the transport without losing AMQP container methods', async (t) => {
  let connections = 0;
  // Accept and immediately close a local socket. No broker, credentials, or events
  // are needed to prove that sender initialization gets past the original error.
  const transport = createServer((socket) => {
    connections += 1;
    socket.destroy();
  });
  await new Promise<void>((resolve, reject) => {
    transport.once('error', reject);
    // Containers may resolve localhost differently for the listener and SDK.
    // The default dual-stack listener accepts both IPv4 and IPv6 loopback.
    transport.listen(0, resolve);
  });
  t.after(() => new Promise<void>((resolve, reject) => {
    transport.close((error) => error ? reject(error) : resolve());
  }));
  const address = transport.address();
  assert.ok(address && typeof address !== 'string');
  const { EventHubProducerClient } = await loadPackagedEventHubs();
  const producer = new EventHubProducerClient(
    'Endpoint=sb://localhost/;SharedAccessKeyName=unused;SharedAccessKey=dGVzdA==',
    'packaging-regression',
    {
      customEndpointAddress: `https://localhost:${address.port}`,
      retryOptions: { maxRetries: 0, timeoutInMs: 500 },
    },
  );
  try {
    let failureMessage = '';
    await assert.rejects(
      producer.createBatch({ abortSignal: AbortSignal.timeout(2000) }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.doesNotMatch(error.message, /get_option|not a function/);
        failureMessage = error.message;
        return true;
      },
    );
    assert.ok(connections > 0, `the packaged sender must reach the local transport: ${failureMessage}`);
  } finally {
    await producer.close();
  }
});
