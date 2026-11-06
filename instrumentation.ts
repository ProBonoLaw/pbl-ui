export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
  // This file only registers Node.js runtime instrumentation. For Edge runtime, implement
  // separate Edge-specific instrumentation (Node SDKs won’t run in the Edge runtime).
}
