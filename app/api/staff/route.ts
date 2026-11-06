'use server';
import { logger } from "@/lib/logger";
// Get all staff members from the database and return as JSON response
import { NextResponse } from 'next/server';
import { TableClient } from '@azure/data-tables';
import { DefaultAzureCredential } from '@azure/identity';
import { parseStaffModel, type StaffModel } from '@/lib/types';

export async function GET(): Promise<NextResponse> {
  // Call Azure Storage Table API to get basic staff details
  const accountName = process.env.STORAGE_ACCOUNT_NAME!;
  const tableName = process.env.STAFF_TABLE_NAME!;
  const credential = new DefaultAzureCredential();
  const tableClient = new TableClient(
    `https://${accountName}.table.core.windows.net`,
    tableName,
    credential,
  );

  const staffMembers: StaffModel[] = [];
  try {
    for await (const entity of tableClient.listEntities<StaffModel>()) {
      staffMembers.push(parseStaffModel({
        ...entity,
        staffId: entity.rowKey!,
      }));
    }
  } catch (error) {
    logger.error(
      'Failed to fetch staff details from Azure Table Storage:',
      error,
    );
    return NextResponse.json(
      { error: 'Failed to fetch staff details' },
      { status: 500 },
    );
  }

  return NextResponse.json(staffMembers);
}
