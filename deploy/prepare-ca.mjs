import { X509Certificate } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function normalizeCertificate(pem) {
  if (/-----BEGIN .*PRIVATE KEY-----/.test(pem)) {
    throw new Error('The internal trust bundle must contain a public CA certificate only');
  }
  const certificate = new X509Certificate(pem);
  if (!certificate.ca) throw new Error('The internal certificate must be a CA');
  return certificate.toString() + '\n';
}

export async function prepareCertificate(environment, outputDirectory) {
  if (!['Test', 'Production'].includes(environment)) {
    throw new Error('DEPLOY_ENVIRONMENT must be Test or Production');
  }
  const name = environment === 'Test'
    ? 'probonolaw-test-internal-root-ca.pem'
    : 'probonolaw-production-internal-root-ca.pem';
  const pem = environment === 'Test'
    ? process.env.TEST_INTERNAL_CA_CERT_PEM || await readFile(join(process.cwd(), 'deploy/private/test-root-ca.pem'), 'utf8')
    : process.env.PRODUCTION_INTERNAL_CA_CERT_PEM;
  if (!pem) throw new Error('PRODUCTION_INTERNAL_CA_CERT_PEM is required');
  await mkdir(outputDirectory, { recursive: true });
  const path = join(outputDirectory, name);
  await writeFile(path, normalizeCertificate(pem), { mode: 0o600 });
  return { path, name };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const certificate = await prepareCertificate(
    process.env.DEPLOY_ENVIRONMENT,
    join(process.env.RUNNER_TEMP || '/tmp', 'probonolaw-ca'),
  );
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `path=${certificate.path}\nname=${certificate.name}\n`);
  }
}
