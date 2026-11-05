'use server';

import { logger } from '@/lib/logger';
import { DefaultAzureCredential } from '@azure/identity';
import { TableClient } from '@azure/data-tables';
import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_BETA_TESTER_TABLE_NAME = 'betatester';
const BETA_TESTER_PARTITION_KEY = 'betatester';
const OPERATION_NAME = 'POST /api/beta-tester';

type BetaTesterSignupBody = {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  consent?: unknown;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: BetaTesterSignupBody;
  try {
    body = (await request.json()) as BetaTesterSignupBody;
  } catch (error) {
    logger.warn(`${OPERATION_NAME} received invalid JSON body:`, error);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const firstName =
    typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const consent = body.consent === true;

  if (!firstName || !lastName || !email) {
    return NextResponse.json(
      { error: 'firstName, lastName, and email are required' },
      { status: 400 },
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: 'A valid email is required' },
      { status: 400 },
    );
  }

  if (!consent) {
    return NextResponse.json(
      { error: 'consent must be true' },
      { status: 400 },
    );
  }

  const accountName = process.env.STORAGE_ACCOUNT_NAME;
  const tableName =
    process.env.BETA_TESTER_TABLE_NAME || DEFAULT_BETA_TESTER_TABLE_NAME;

  if (!accountName) {
    logger.error(
      `${OPERATION_NAME} missing required STORAGE_ACCOUNT_NAME env var`,
    );
    return NextResponse.json(
      { error: 'Server misconfiguration' },
      { status: 500 },
    );
  }

  try {
    const tableClient = new TableClient(
      `https://${accountName}.table.core.windows.net`,
      tableName,
      new DefaultAzureCredential(),
    );

    const createdAt = new Date().toISOString();
    await tableClient.createEntity({
      partitionKey: BETA_TESTER_PARTITION_KEY,
      rowKey: crypto.randomUUID(),
      firstName,
      lastName,
      email,
      consent: true,
      source: 'website',
      createdAt,
      updatedAt: createdAt,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    logger.error(`${OPERATION_NAME} failed to persist signup:`, error);
    return NextResponse.json(
      { error: 'Failed to submit beta tester signup' },
      { status: 500 },
    );
  }
}
