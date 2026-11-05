import { createServer } from 'node:http';
import next from 'next';

// Keep request handlers in the inspected Bun process. The Next CLI forks its
// development server, which otherwise leaves API breakpoints in a child process.
const port = Number(process.env.API_PORT ?? 3001);
const app = next({ dev: true, dir: process.cwd(), hostname: '0.0.0.0', port });
const handler = app.getRequestHandler();
await app.prepare();
const server = createServer((request, response) => handler(request, response));
server.listen(port, '0.0.0.0', () => console.log(`Bun API debugger: http://localhost:${port}`));

async function stop() {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await app.close();
  process.exit(0);
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
