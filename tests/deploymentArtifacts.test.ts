import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { packageStandalone } from '../deploy/package-standalone.mjs';
import { normalizeCertificate } from '../deploy/prepare-ca.mjs';
import { renderKubernetes } from '../deploy/render-kubernetes.mjs';
import { splitRuntimeSettings } from '../deploy/runtime-settings.mjs';
import { webAppSettings } from '../deploy/webapp-settings.mjs';
import { resolvedReferences } from '../deploy/verify-keyvault.mjs';
import { loadKeyVaultSettings } from '../deploy/keyvault-start.mjs';

const certificate = await readFile(new URL('./fixtures/test-root-ca.crt', import.meta.url), 'utf8');
const image = 'registry.example.test/pb-law-backend@sha256:' + 'a'.repeat(64);
const workloadClientId = '00000000-0000-4000-8000-000000000001';
const vaultName = 'example-vault';
const tenantId = '00000000-0000-4000-8000-000000000003';
const frontDoorId = '00000000-0000-4000-8000-000000000076';
const reference = '@Microsoft.KeyVault(SecretUri=https://example-vault.vault.azure.net/secrets/probonolaw-ui-cosmos-sql-key)';

test('standalone package includes legal content and assets while removing local credentials', async (t) => {
  const project = await mkdtemp(join(tmpdir(), 'pb-law-package-'));
  t.after(() => rm(project, { recursive: true, force: true }));
  const files = {
    'build/standalone/server.js': 'server',
    'build/standalone/.env': 'secret',
    'build/standalone/.env.local': 'secret',
    'build/standalone/.npmrc': 'token',
    'build/standalone/deploy/private/soc2-report.pdf': 'stale report from an older build',
    'build/static/app.js': 'client',
    'public/logo.png': 'logo',
    'archives/TermsAndAgreements.zip': 'agreements',
    'lib/terms-of-service-agreements/user/default.md': 'terms',
    'internal-ca.pem': certificate,
    'deploy/private/soc2-report.pdf': 'private deployment report',
    'deploy/private/azure-environments.json': 'private inventory must not enter the application package',
  };
  for (const [path, contents] of Object.entries(files)) {
    await mkdir(join(project, path, '..'), { recursive: true });
    await writeFile(join(project, path), contents);
  }
  await packageStandalone(project, join(project, 'internal-ca.pem'));
  for (const path of ['build/static/app.js', 'public/logo.png', 'archives/TermsAndAgreements.zip', 'lib/terms-of-service-agreements/user/default.md', 'certs/internal-ca.pem']) {
    assert.ok((await readFile(join(project, 'build/standalone', path))).length);
  }
  const packagedFiles = await readdir(join(project, 'build/standalone'));
  assert.ok(!packagedFiles.some((name) => name.startsWith('.env') || name === '.npmrc'));
  await assert.rejects(readFile(join(project, 'build/standalone/deploy/private/soc2-report.pdf')), { code: 'ENOENT' });
  await assert.rejects(readFile(join(project, 'build/standalone/deploy/private/azure-environments.json')), { code: 'ENOENT' });
});

test('trust bundle rejects private keys and malformed certificates', () => {
  assert.match(normalizeCertificate(certificate), /^-----BEGIN CERTIFICATE-----/);
  assert.throws(() => normalizeCertificate(certificate + '\n-----BEGIN PRIVATE KEY-----'), /public CA/);
  assert.throws(() => normalizeCertificate('invalid certificate'));
});

test('Kubernetes release fetches secrets through workload identity without including their values', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'pb-law-k8s-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await renderKubernetes({ image, namespace: 'probonolaw-ui', certificate, workloadClientId, vaultName, tenantId, frontDoorId, outputDirectory: directory, settings: [
    { name: 'COSMOS_SQL_KEY', value: reference },
    { name: 'NODE_EXTRA_CA_CERTS', value: '/home/site/wwwroot/certs/ca.pem' },
  ] });
  const settings = JSON.parse(await readFile(join(directory, 'settings.json'), 'utf8'));
  assert.equal(settings.kind, 'ConfigMap');
  assert.equal(settings.data.COSMOS_SQL_KEY, undefined);
  assert.equal(settings.data.NODE_EXTRA_CA_CERTS, '/app/certs/internal-root-ca.pem');
  assert.equal(settings.data.AZURE_TOKEN_CREDENTIALS, 'WorkloadIdentityCredential');
  const provider = JSON.parse(await readFile(join(directory, 'key-vault.json'), 'utf8'));
  assert.equal(provider.kind, 'SecretProviderClass');
  assert.equal(provider.spec.parameters.clientID, workloadClientId);
  assert.equal(provider.spec.parameters.keyvaultName, vaultName);
  assert.equal(provider.spec.parameters.tenantId, tenantId);
  assert.equal(provider.spec.secretObjects, undefined);
  assert.match(provider.spec.parameters.objects, /objectName: probonolaw-ui-cosmos-sql-key/);
  assert.match(provider.spec.parameters.objects, /objectAlias: COSMOS_SQL_KEY/);
  assert.match(provider.spec.parameters.objects, /objectVersion: ""/);
  assert.equal(settings.data.KEY_VAULT_SECRETS_DIR, '/mnt/keyvault');
  assert.equal(settings.data.PORTAL_API_ONLY, 'true');
  assert.equal(settings.data.PORTAL_LOCAL_DEVELOPMENT, 'false');
  assert.equal(settings.data.AZURE_FRONT_DOOR_ID, frontDoorId);
  const serviceAccount = JSON.parse(await readFile(join(directory, 'service-account.json'), 'utf8'));
  assert.equal(serviceAccount.metadata.annotations['azure.workload.identity/client-id'], workloadClientId);
  const kustomization = JSON.parse(await readFile(join(directory, 'kustomization.yaml'), 'utf8'));
  assert.equal(kustomization.images[0].digest, 'sha256:' + 'a'.repeat(64));
  assert.equal(kustomization.namespace, 'probonolaw-ui');
  // Exercise the real Kustomize transformation when kubectl is installed.
  const kubectl = spawnSync('kubectl', ['version', '--client=true'], { encoding: 'utf8' });
  if (!kubectl.error) {
    const rendered = execFileSync('kubectl', ['kustomize', directory], { encoding: 'utf8' });
    assert.ok(rendered.includes(image));
    assert.match(rendered, /namespace: probonolaw-ui/);
    assert.match(rendered, /settings-hash:/);
    assert.doesNotMatch(rendered, /^kind: Secret$/m);
    assert.match(rendered, /driver: secrets-store.csi.k8s.io/);
  }
});

test('Kubernetes settings updates change the pod template and invalid release inputs are rejected', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'pb-law-k8s-inputs-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const options = { image, namespace: 'probonolaw-ui', certificate, workloadClientId, vaultName, tenantId, frontDoorId, releaseId: 'first-release', outputDirectory: directory, settings: [{ name: 'COSMOS_SQL_KEY', value: reference }, { name: 'STORAGE_ACCOUNT_NAME', value: 'first' }] };
  await renderKubernetes(options);
  const before = await readFile(join(directory, 'kustomization.yaml'), 'utf8');
  await renderKubernetes({ ...options, settings: [{ name: 'COSMOS_SQL_KEY', value: reference }, { name: 'STORAGE_ACCOUNT_NAME', value: 'second' }] });
  assert.notEqual(before, await readFile(join(directory, 'kustomization.yaml'), 'utf8'));
  await renderKubernetes({ ...options, releaseId: 'second-release' });
  assert.notEqual(before, await readFile(join(directory, 'kustomization.yaml'), 'utf8'));
  await renderKubernetes({ ...options, workloadClientId: '00000000-0000-4000-8000-000000000002' });
  assert.notEqual(before, await readFile(join(directory, 'kustomization.yaml'), 'utf8'));
  await assert.rejects(renderKubernetes({ ...options, namespace: 'default; echo unsafe' }), /DNS label/);
  await assert.rejects(renderKubernetes({ ...options, image: 'registry/app:latest' }), /SHA-256 digest/);
  await assert.rejects(renderKubernetes({ ...options, releaseId: 'invalid release id' }), /DEPLOY_RELEASE_ID/);
});

test('releases reject plaintext credentials, credential URLs, and references to unrelated vault secrets', () => {
  for (const setting of [
    { name: 'AZURE_CLIENT_SECRET', value: 'sensitive' },
    { name: 'AIMIE_QA_URL', value: 'https://example.org/function?code=sensitive' },
    { name: 'SETTING', value: 'AccountKey=sensitive' },
    { name: 'SIGNING_PEM', value: '-----BEGIN RSA PRIVATE KEY-----' },
  ]) assert.throws(() => splitRuntimeSettings([setting], vaultName), /Raw secret/);
  assert.throws(() => splitRuntimeSettings([{ name: 'COSMOS_SQL_KEY', value: reference.replace(vaultName, 'unrelated-vault') }], vaultName), /Unexpected/);
  assert.throws(() => splitRuntimeSettings([{ name: 'COSMOS_SQL_KEY', value: reference.replace('probonolaw-ui-cosmos-sql-key', 'another-app-key') }], vaultName), /Unexpected/);
  const split = splitRuntimeSettings([{ name: 'COSMOS_SQL_KEY', value: reference }, { name: 'NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING', value: 'InstrumentationKey=public' }], vaultName);
  assert.equal(split.config.NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING, 'InstrumentationKey=public');
});

test('Web App settings preserve Key Vault references and resolution failures block releases', () => {
  const settings = webAppSettings([{ name: 'COSMOS_SQL_KEY', value: reference }], { KEY_VAULT_NAME: vaultName, INTERNAL_CA_CERT_NAME: 'internal-root.pem' });
  assert.equal(settings.COSMOS_SQL_KEY, reference);
  assert.equal(settings.NODE_EXTRA_CA_CERTS, '/home/site/wwwroot/certs/internal-root.pem');
  const secrets = splitRuntimeSettings([{ name: 'COSMOS_SQL_KEY', value: reference }], vaultName).secrets;
  assert.deepEqual(resolvedReferences({ value: [{ name: 'COSMOS_SQL_KEY', properties: { status: 'Resolved', activeVersion: null } }] }, secrets), ['COSMOS_SQL_KEY']);
  assert.throws(() => resolvedReferences({ value: [{ name: 'COSMOS_SQL_KEY', properties: { status: 'AccessToKeyVaultDenied' } }] }, secrets), /AccessToKeyVaultDenied/);
  assert.throws(() => resolvedReferences({ value: [] }, secrets), /missing resolution status/);
});

test('container startup loads mounted credentials before the server and rejects invalid or empty mounts', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'pb-law-mounted-settings-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await assert.rejects(loadKeyVaultSettings(directory, {}), /no settings/);
  await writeFile(join(directory, '.provider-metadata'), 'ignored');
  await writeFile(join(directory, 'COSMOS_SQL_KEY'), 'mock-key\nwith-newline');
  const environment = { COSMOS_SQL_KEY: 'stale-value' };
  assert.equal(await loadKeyVaultSettings(directory, environment), 1);
  assert.equal(environment.COSMOS_SQL_KEY, 'mock-key\nwith-newline');
  await writeFile(join(directory, 'AZURE_CLIENT_SECRET'), '');
  await assert.rejects(loadKeyVaultSettings(directory, {}), /Empty/);
  await rm(join(directory, 'AZURE_CLIENT_SECRET'));
  await writeFile(join(directory, 'bad-name'), 'mock');
  await assert.rejects(loadKeyVaultSettings(directory, {}), /Invalid setting filename/);
});

test('AKS deployment fails when Azure CLI succeeds but the remote command fails', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'pb-law-aks-exit-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'az'), '#!/bin/sh\nprintf \'{"exitCode":1,"logs":"rollout failed"}\'\n', { mode: 0o700 });
  const result = spawnSync('bash', ['deploy/invoke-aks.sh'], {
    cwd: process.cwd(), encoding: 'utf8', env: {
      ...process.env, PATH: directory + ':' + process.env.PATH,
      K8S_NAMESPACE: 'probonolaw-ui', AKS_RESOURCE_GROUP: 'test-rg',
      AKS_CLUSTER_NAME: 'test-cluster', DEPLOY_OUTPUT_DIR: directory,
      DEPLOY_IMAGE: image,
    },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /AKS deployment command failed/);
});

test('AKS digest verification expands the release image before executing in the remote shell', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'pb-law-aks-digest-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'az'), `#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const command = process.argv[process.argv.indexOf('--command') + 1];
const env = { ...process.env };
delete env.DEPLOY_IMAGE;
const result = spawnSync('bash', ['-c', command], { env, encoding: 'utf8' });
process.stdout.write(JSON.stringify({ exitCode: result.status, logs: result.stdout + result.stderr }));
`, { mode: 0o700 });
  await writeFile(join(directory, 'kubectl'), `#!/bin/sh
if [ "$1" = get ] && [ "$2" = deployment/pb-law-backend ]; then
  printf '%s' "$MOCK_DEPLOYED_IMAGE"
fi
`, { mode: 0o700 });
  const invoke = (deployedImage: string) => spawnSync('bash', ['deploy/invoke-aks.sh'], {
    cwd: process.cwd(), encoding: 'utf8', env: {
      ...process.env, PATH: directory + ':' + process.env.PATH,
      K8S_NAMESPACE: 'probonolaw-ui', AKS_RESOURCE_GROUP: 'test-rg',
      AKS_CLUSTER_NAME: 'test-cluster', DEPLOY_OUTPUT_DIR: directory,
      DEPLOY_IMAGE: image, MOCK_DEPLOYED_IMAGE: deployedImage,
    },
  });
  const matched = invoke(image);
  assert.equal(matched.status, 0, matched.stderr);
  assert.match(matched.stdout, /@sha256:a{64}/);
  const mismatched = invoke(image.replace(/a{64}$/, 'b'.repeat(64)));
  assert.equal(mismatched.status, 1);
  assert.match(mismatched.stderr, /AKS deployment command failed/);
});

test('Static Web Apps explicitly rewrites dynamic routes with asset-like folder names', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'pb-law-static-package-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'app'));
  await mkdir(join(directory, 'out'));
  await writeFile(join(directory, 'app/favicon.ico'), 'icon');
  execFileSync(process.execPath, [join(process.cwd(), 'deploy/package-static.mjs')], { cwd: directory });
  const config = JSON.parse(await readFile(join(directory, 'out/staticwebapp.config.json'), 'utf8'));
  for (const pathname of ['/cases/example/documents/root/Correspondence.txt', '/staff/example.json']) {
    const route = config.routes.find((rule: { route: string }) => pathname.startsWith(rule.route.slice(0, -1)));
    assert.equal(route.rewrite, '/index.html');
  }
  assert.equal(config.routes[0].statusCode, 404);
  assert.ok(config.navigationFallback.exclude.includes('/assets/*'));
  assert.ok(config.navigationFallback.exclude.some((pattern: string) => pattern.includes('txt')));
});

test('local static hosting serves dotted dynamic URLs while missing assets remain 404', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'pb-law-static-server-'));
  const shell = '<!doctype html><title>Portal</title><div id="root"></div>';
  await writeFile(join(directory, 'index.html'), shell);
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'assets/example.txt'), 'asset');
  const server = spawn(process.execPath, ['deploy/static-server.mjs'], {
    cwd: process.cwd(), env: { ...process.env, STATIC_ROOT: directory, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    server.kill();
    await rm(directory, { recursive: true, force: true });
  });
  const origin = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Static server did not start')), 5000);
    let output = '';
    server.stdout.on('data', (data) => {
      output += data;
      const match = output.match(/http:\/\/localhost:\d+/);
      if (match) { clearTimeout(timeout); resolve(match[0]); }
    });
    server.once('error', (error) => { clearTimeout(timeout); reject(error); });
    server.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Static server exited: ${code}`)); });
  });
  for (const pathname of ['/cases/example/documents/root/Correspondence.txt', '/staff/example.json']) {
    const response = await fetch(origin + pathname);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /text\/html/);
    assert.equal(await response.text(), shell);
    const head = await fetch(origin + pathname, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
  }
  for (const pathname of ['/assets/missing.js', '/assets/missing', '/missing.txt']) {
    assert.equal((await fetch(origin + pathname)).status, 404);
  }
  assert.equal(await (await fetch(origin + '/assets/example.txt')).text(), 'asset');
});
