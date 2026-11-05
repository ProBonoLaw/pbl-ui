import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SOC2_REPORT_PATH = join(
  process.cwd(),
  'deploy',
  'private',
  'soc2-report.pdf',
);

export async function GET() {
  try {
    const report = await readFile(SOC2_REPORT_PATH);

    const reportBody = new Uint8Array(report);

    return new NextResponse(reportBody, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          'inline; filename="probono-law-soc-2-type-2-report.pdf"',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'SOC 2 Type 2 report not found' },
      { status: 404 },
    );
  }
}
