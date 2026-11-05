import { copyFile, writeFile } from 'node:fs/promises';

await copyFile('app/favicon.ico', 'out/favicon.ico');
// Front Door owns /api/*; SWA must never rewrite an API request to index.html.
await writeFile('out/staticwebapp.config.json', JSON.stringify({
  navigationFallback: {
    rewrite: '/index.html', exclude: ['/api/*', '/assets/*', '/*.{ico,png,jpg,jpeg,svg,webp,pdf,txt,json}'],
  },
  routes: [
    { route: '/api/*', statusCode: 404 },
    // Dynamic IDs and document folder names can have file-like suffixes.
    { route: '/cases/*', rewrite: '/index.html' },
    { route: '/staff/*', rewrite: '/index.html' },
  ],
  globalHeaders: { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' },
}, null, 2));
