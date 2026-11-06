import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/postcss';

const publicNames = [
  'NEXT_PUBLIC_AAD_TENANT_ID', 'NEXT_PUBLIC_AAD_CLIENT_ID',
  'NEXT_PUBLIC_AAD_REDIRECT_URI', 'NEXT_PUBLIC_AAD_API_SCOPE', 'NEXT_PUBLIC_AAD_ATTORNEY_EXTENSION',
  'NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING', 'NEXT_PUBLIC_LOG_LEVEL',
  'NEXT_PUBLIC_SUPPORT_EMAIL',
];

function browserBoundary(): Plugin {
  return {
    name: 'browser-server-boundary',
    enforce: 'pre',
    resolveId(source, importer) {
      if (importer && (/^node:/.test(source) || /^next\/(server|headers|font)/.test(source) || source === 'server-only' ||
        /^@azure\/(cosmos|data-tables|event-hubs|identity|monitor-|storage-blob|web-pubsub$)/.test(source))) {
        throw new Error(`Server module ${source} imported into the static UI by ${importer}`);
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const environment = { ...loadEnv(mode, process.cwd(), 'NEXT_PUBLIC_'), ...process.env };
  return {
    root: 'frontend',
    publicDir: resolve('public'),
    plugins: [browserBoundary(), react({ babel: { plugins: ['babel-plugin-react-compiler'] } })],
    css: { postcss: { plugins: [tailwind()] } },
    resolve: { alias: [
      { find: 'next/link', replacement: resolve('frontend/next/link.tsx') },
      { find: 'next/navigation', replacement: resolve('frontend/next/navigation.ts') },
      { find: 'next/image', replacement: resolve('frontend/next/image.tsx') },
      { find: '@', replacement: resolve('.') },
    ] },
    define: {
      ...Object.fromEntries(publicNames.map(name => [`process.env.${name}`, JSON.stringify(environment[name] ?? '')])),
      'process.env.LOG_LEVEL': 'undefined',
    },
    server: {
      host: '0.0.0.0', port: Number(process.env.PORT ?? 3000), strictPort: true,
      proxy: { '/api': { target: `http://127.0.0.1:${process.env.API_PORT ?? 3001}` } },
    },
    build: { outDir: resolve('out'), emptyOutDir: true, sourcemap: false },
  };
});
