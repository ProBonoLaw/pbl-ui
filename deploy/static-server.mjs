import { resolve, sep } from 'node:path';

const root = resolve(process.env.STATIC_ROOT ?? 'out');
const apiOrigin = process.env.API_ORIGIN ?? `http://127.0.0.1:${process.env.API_PORT ?? 3001}`;
const server = Bun.serve({
  hostname: '0.0.0.0', port: Number(process.env.PORT ?? 3000),
  // Match the API's existing document upload limit, including multipart overhead.
  maxRequestBodySize: 251_000_000,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const headers = new Headers(request.headers);
      headers.delete('host');
      // Local production tests exercise the same profile-header guard as AKS.
      if (process.env.AZURE_FRONT_DOOR_ID) headers.set('X-Azure-FDID', process.env.AZURE_FRONT_DOOR_ID);
      return fetch(`${apiOrigin}${url.pathname}${url.search}`, {
        method: request.method, headers,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
        redirect: 'manual',
      });
    }
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 });
    const path = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (path !== root && !path.startsWith(root + sep)) return new Response(null, { status: 400 });
    let file = Bun.file(path);
    if (!(await file.exists())) {
      const dynamicPage = /^\/(cases|staff)\//.test(url.pathname);
      if (url.pathname.startsWith('/assets/') || (!dynamicPage && /\.[a-z0-9]+$/i.test(url.pathname))) return new Response(null, { status: 404 });
      file = Bun.file(resolve(root, 'index.html'));
    }
    if (path === root) file = Bun.file(resolve(root, 'index.html'));
    return new Response(request.method === 'HEAD' ? null : file, {
      headers: { 'Content-Type': file.type, 'X-Content-Type-Options': 'nosniff' },
    });
  },
});
console.log(`Static UI on http://localhost:${server.port}; /api → ${apiOrigin}`);
