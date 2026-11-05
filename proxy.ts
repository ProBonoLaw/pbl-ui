import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  if (process.env.PORTAL_API_ONLY !== 'true') return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/api/')) return new NextResponse(null, { status: 404 });
  // Both Front Door and Kubernetes probe this public, non-sensitive endpoint.
  if (pathname === '/api/health' && ['GET', 'HEAD'].includes(request.method)) return NextResponse.next();
  if (process.env.PORTAL_LOCAL_DEVELOPMENT === 'true' && !process.env.KEY_VAULT_SECRETS_DIR) return NextResponse.next();
  const profile = process.env.AZURE_FRONT_DOOR_ID;
  if (!profile || request.headers.get('x-azure-fdid') !== profile) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.next();
}
