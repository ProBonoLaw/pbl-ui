'use server';
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from 'next/server';
import { TableClient } from '@azure/data-tables';
import { DefaultAzureCredential } from '@azure/identity';
import { parseStaffModel } from '@/lib/types';

function getStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const errorRecord = err as Record<string, unknown>;
  const statusCode = errorRecord.statusCode;
  const status = errorRecord.status;
  if (typeof statusCode === 'number') return statusCode;
  if (typeof status === 'number') return status;
  return undefined;
}

function getCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const code = (err as Record<string, unknown>).code;
  return typeof code === 'string' ? code : undefined;
}

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/staff/[staffid]'>,
): Promise<NextResponse> {
  const { staffid } = await ctx.params;

  const accountName = process.env.STORAGE_ACCOUNT_NAME;
  const tableName = process.env.STAFF_TABLE_NAME;

  if (!accountName || !tableName) {
    logger.error('Missing STORAGE_ACCOUNT_NAME or STAFF_TABLE_NAME');
    return NextResponse.json(
      { error: 'Server misconfiguration' },
      { status: 500 },
    );
  }

  const credential = new DefaultAzureCredential();
  const tableClient = new TableClient(
    `https://${accountName}.table.core.windows.net`,
    tableName,
    credential,
  );

  try {
    const entity = await tableClient.getEntity('staff', staffid);
    const member = parseStaffModel({ ...entity, staffId: staffid });
    return NextResponse.json(member);
  } catch (err) {
    const status = getStatus(err);
    const code = getCode(err);

    if (status === 404) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 },
      );
    }

    // Common transient/network cases worth treating as "upstream unavailable"
    if (
      status === 429 || // throttling
      (status && status >= 500) ||
      code === 'ETIMEDOUT' ||
      code === 'ECONNRESET' ||
      code === 'ENOTFOUND'
    ) {
      logger.error('Azure Table Storage unavailable:', err);
      return NextResponse.json(
        { error: 'Storage service unavailable' },
        { status: 503 },
      );
    }

    logger.error('Failed to fetch staff details:', err);
    return NextResponse.json(
      { error: 'Failed to fetch staff details' },
      { status: 500 },
    );
  }
}
