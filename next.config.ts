import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  reactCompiler: true,
  distDir: 'build',
  output: 'standalone',
  experimental: {
    // Proxy clones the body before API route handling; the default 10 MB limit
    // would truncate document uploads accepted by the API and public ingress.
    proxyClientMaxBodySize: 251_000_000,
    serverActions: {
      bodySizeLimit: '250mb',
    },
  },
  serverExternalPackages: [
    // Rhea's CommonJS container relies on prototype methods that bundling loses.
    // Load the Event Hubs SDK natively for every API route that publishes events.
    '@azure/event-hubs',
    '@azure/monitor-opentelemetry',
    '@opentelemetry/instrumentation',
    'require-in-the-middle',
    'import-in-the-middle',
    '@azure/monitor-opentelemetry-exporter',
  ],
};

export default nextConfig;
