import { execFileSync } from 'node:child_process';
import { cp, mkdir, lstat } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';

const destination = resolve(process.argv[2] || '');
const project = process.cwd();
if (!process.argv[2] || !relative(project, destination).startsWith('..')) {
  throw new Error('Specify an empty output directory outside the source repository');
}
// mkdir must fail if the output already exists; never merge with a prior export.
await mkdir(destination);
const names = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const excluded = name => name.startsWith('deploy/private/') || name.startsWith('.github/private-sync/') ||
  name === '.github/workflows/sync-from-public.yml' || name === 'OPEN_SOURCE_READINESS.md';
let count = 0;
for (const name of names) {
  if (excluded(name)) continue;
  const filename = name.split('/').at(-1);
  if ((filename.startsWith('.env') && filename !== '.env.example') || filename === '.npmrc' ||
    /\.(?:pdf|pem|pfx|p12|key)$/i.test(filename)) {
    throw new Error(`Unexpected private document or credential file in public source: ${name}`);
  }
  const source = resolve(project, name);
  const info = await lstat(source);
  if (!info.isFile()) throw new Error(`Public exports require regular files: ${name}`);
  await mkdir(dirname(resolve(destination, name)), { recursive: true });
  await cp(source, resolve(destination, name));
  count++;
}
console.log(`Exported ${count} tracked files without private deployment assets or Git history`);
