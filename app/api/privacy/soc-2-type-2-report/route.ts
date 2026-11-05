import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Reports are distributed manually after an email request. Keep the former
// download URL closed even when the private source tree contains the PDF.
export async function GET() {
  return NextResponse.json(
    { error: 'SOC 2 Type 2 reports are available by email request only.' },
    { status: 410, headers: { 'Cache-Control': 'private, no-store' } },
  );
}
