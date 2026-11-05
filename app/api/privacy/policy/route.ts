import { getPrivacyPolicyDocument } from '@/lib/privacyPolicyDocuments';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const document = await getPrivacyPolicyDocument();
    const lines = ['# ' + document.title];

    if (document.effectiveDate) {
      lines.push('', 'Effective: ' + document.effectiveDate);
    }

    if (document.markdown.trim()) {
      lines.push('', document.markdown.trim());
    }

    return new NextResponse(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Privacy policy not found' },
      { status: 404 },
    );
  }
}
