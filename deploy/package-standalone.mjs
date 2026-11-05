import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function packageStandalone(projectDirectory, certificatePath) {
  const destination = join(projectDirectory, 'build', 'standalone');
  await stat(join(destination, 'server.js'));
  await stat(join(projectDirectory, 'archives', 'TermsAndAgreements.zip'));
  for (const relative of ['build/static', 'public', 'archives', 'lib/terms-of-service-agreements']) {
    await cp(join(projectDirectory, relative), join(destination, relative), { recursive: true });
  }
  // Private records are distributed manually, never by the application. Also
  // remove copies left by tracing or an older incremental package build.
  await rm(join(destination, 'deploy/private'), { recursive: true, force: true });
  if (certificatePath) {
    await mkdir(join(destination, 'certs'), { recursive: true });
    await cp(certificatePath, join(destination, 'certs', basename(certificatePath)));
  }
  // Next.js may trace local environment files during an interactive build.
  for (const entry of await readdir(destination)) {
    if (entry === '.npmrc' || entry === '.env' || entry.startsWith('.env.')) {
      await rm(join(destination, entry), { force: true, recursive: true });
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await packageStandalone(process.cwd(), process.env.INTERNAL_CA_CERT_PATH);
}
