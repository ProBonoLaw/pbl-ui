import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { normalizeCertificate } from './prepare-ca.mjs';
import { splitRuntimeSettings } from './runtime-settings.mjs';

export async function renderKubernetes({ image, namespace, settings, certificate, outputDirectory, workloadClientId, vaultName, tenantId, frontDoorId, releaseId = 'manual' }) {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(namespace)) {
    throw new Error('K8S_NAMESPACE must be a Kubernetes DNS label');
  }
  const imageMatch = image.match(/^([a-z0-9][a-z0-9.:/-]*)@(sha256:[a-f0-9]{64})$/);
  if (!imageMatch) throw new Error('DEPLOY_IMAGE must specify a registry image and SHA-256 digest');
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(workloadClientId)) {
    throw new Error('K8S_AZURE_CLIENT_ID must be the workload managed identity client ID');
  }
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(tenantId)) {
    throw new Error('AZURE_TENANT_ID must be the Azure tenant ID');
  }
  const { config: runtimeSettings, secrets } = splitRuntimeSettings(settings, vaultName);
  if (!/^[a-z0-9_.-]{1,128}$/i.test(releaseId)) throw new Error('DEPLOY_RELEASE_ID is invalid');
  runtimeSettings.LEGAL_DOCUMENT_ARCHIVE_PATH = 'archives/TermsAndAgreements.zip';
  runtimeSettings.NODE_EXTRA_CA_CERTS = '/app/certs/internal-root-ca.pem';
  // The Graph client also needs AZURE_CLIENT_SECRET. Restrict storage's default
  // credential chain to the pod identity so it does not try that unrelated secret.
  runtimeSettings.AZURE_TOKEN_CREDENTIALS = 'WorkloadIdentityCredential';
  runtimeSettings.KEY_VAULT_SECRETS_DIR = '/mnt/keyvault';
  runtimeSettings.PORTAL_API_ONLY = 'true';
  runtimeSettings.PORTAL_LOCAL_DEVELOPMENT = 'false';
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(frontDoorId ?? '')) throw new Error('Invalid Front Door profile ID');
  runtimeSettings.AZURE_FRONT_DOOR_ID = frontDoorId;
  const normalizedCertificate = normalizeCertificate(certificate);
  const settingsHash = createHash('sha256')
    .update(JSON.stringify(Object.entries(runtimeSettings).sort()))
    .update(JSON.stringify(secrets.map(secret => [secret.name, secret.secretName, secret.version]).sort()))
    .update(vaultName).update(tenantId).update(releaseId)
    .update(normalizedCertificate).update(workloadClientId).digest('hex');
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  await cp(new URL('./kubernetes/backend.yaml', import.meta.url), join(outputDirectory, 'backend.yaml'));
  const resources = {
    'namespace.json': { apiVersion: 'v1', kind: 'Namespace', metadata: { name: namespace } },
    'service-account.json': {
      apiVersion: 'v1', kind: 'ServiceAccount', metadata: {
        name: 'pb-law-backend',
        annotations: { 'azure.workload.identity/client-id': workloadClientId },
      },
    },
    'settings.json': {
      apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: 'pb-law-backend-config' },
      data: runtimeSettings,
    },
    'key-vault.json': {
      apiVersion: 'secrets-store.csi.x-k8s.io/v1', kind: 'SecretProviderClass',
      metadata: { name: 'pb-law-backend-key-vault' },
      spec: {
        provider: 'azure',
        parameters: {
          usePodIdentity: 'false', clientID: workloadClientId,
          keyvaultName: vaultName, tenantId,
          objects: 'array:\n' + secrets.map(secret => '  - |\n' +
            `    objectName: ${secret.secretName}\n    objectType: secret\n` +
            `    objectAlias: ${secret.name}\n    objectVersion: "${secret.version}"\n`).join(''),
        },
      },
    },
    'trust-bundle.json': {
      apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: 'pb-law-backend-ca' },
      data: { 'internal-root-ca.pem': normalizedCertificate },
    },
  };
  for (const [name, resource] of Object.entries(resources)) {
    await writeFile(join(outputDirectory, name), JSON.stringify(resource), { mode: 0o600 });
  }
  await writeFile(join(outputDirectory, 'kustomization.yaml'), JSON.stringify({
    apiVersion: 'kustomize.config.k8s.io/v1beta1', kind: 'Kustomization',
    namespace, resources: ['backend.yaml', ...Object.keys(resources)],
    images: [{ name: 'pb-law-backend', newName: imageMatch[1], digest: imageMatch[2] }],
    patches: [{
      target: { kind: 'Deployment', name: 'pb-law-backend' },
      patch: JSON.stringify([{
        op: 'add', path: '/spec/template/metadata/annotations',
        value: { 'probonolaw.com/settings-hash': settingsHash },
      }]),
    }],
  }), { mode: 0o600 });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await renderKubernetes({
    image: process.env.DEPLOY_IMAGE,
    namespace: process.env.K8S_NAMESPACE,
    settings: JSON.parse(await readFile(process.env.RUNTIME_SETTINGS_PATH, 'utf8')),
    certificate: await readFile(process.env.INTERNAL_CA_CERT_PATH, 'utf8'),
    outputDirectory: process.env.DEPLOY_OUTPUT_DIR,
    workloadClientId: process.env.K8S_AZURE_CLIENT_ID,
    vaultName: process.env.KEY_VAULT_NAME,
    tenantId: process.env.AZURE_TENANT_ID,
    frontDoorId: process.env.AZURE_FRONT_DOOR_ID,
    releaseId: process.env.DEPLOY_RELEASE_ID,
  });
}
