import { spawn } from 'node:child_process';

const mode = process.argv[2] ?? 'dev';
const port = Number(process.env.PORT ?? 3000);
const apiPort = Number(process.env.API_PORT ?? port + 1);
const environment = { ...process.env, API_PORT: String(apiPort), PORT: String(port) };
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      if (process.platform === 'win32') child.kill('SIGTERM');
      else process.kill(-child.pid, 'SIGTERM');
    } catch (error) {
      if (error.code !== 'ESRCH') console.error(error);
    }
  }
  process.exitCode = code;
}
function start(args, env) {
  const child = spawn(process.execPath, args, { env, stdio: 'inherit', detached: process.platform !== 'win32' });
  children.push(child);
  child.on('exit', code => stop(code ?? 1));
  child.on('error', error => { console.error(error); stop(1); });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
if (mode === 'dev') {
  const content = spawn(process.execPath, ['deploy/export-public-content.ts'], { env: environment, stdio: 'inherit' });
  if ((await new Promise(resolve => content.on('exit', resolve))) !== 0) process.exit(1);
  start(['--bun', 'run', 'next', 'dev', '--port', String(apiPort)], {
    ...environment, PORT: String(apiPort), PORTAL_API_ONLY: 'true', PORTAL_LOCAL_DEVELOPMENT: 'true',
  });
  start(['--bun', 'run', 'vite', '--host', '0.0.0.0'], environment);
} else if (mode === 'production') {
  start(['deploy/keyvault-start.mjs'], {
    ...environment, PORT: String(apiPort), HOSTNAME: '0.0.0.0',
    API_SERVER_PATH: 'build/standalone/server.js', PORTAL_API_ONLY: 'true',
    PORTAL_LOCAL_DEVELOPMENT: environment.AZURE_FRONT_DOOR_ID ? 'false' : 'true',
  });
  start(['deploy/static-server.mjs'], environment);
} else {
  throw new Error('Expected dev or production');
}
