import { logger } from "@/lib/logger";
import { getCosmosContainer } from '@/lib/cosmos';
import { UnauthorizedError } from '@/lib/types';
import { validateRequestToken } from '@/lib/validateToken';
import { SqlQuerySpec } from '@azure/cosmos';
import { NextRequest, NextResponse } from 'next/server';

const ROOT_ACCOUNT_ID = '00000000-0000-0000-0000-000000000000';

export async function POST(request: NextRequest) {
  try {
    const payload = await validateRequestToken(request);

    const oid = payload.oid as string | undefined;
    if (!oid) {
      return NextResponse.json({ error: 'Missing oid claim' }, { status: 400 });
    }

    const container = getCosmosContainer();
    const querySpec: SqlQuerySpec = {
      query:
        'SELECT TOP 1 * from c WHERE c.accountId = @accountId AND array_contains(c.oids, @userId)',
      parameters: [
        { name: '@accountId', value: ROOT_ACCOUNT_ID },
        { name: '@userId', value: oid },
      ],
    };

    const { resources: items } = await container.items
      .query(querySpec)
      .fetchAll();
    if (items.length > 0) {
      return NextResponse.json({ initialized: true, created: false });
    }

    // An identity-provider login is not an application account. The account is
    // created atomically with affirmative clickwrap acceptance in /terms.
    return NextResponse.json({ initialized: false, created: false });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: 'Invalid or missing token' },
        { status: 401 },
      );
    }
    logger.error('Failed to initialize account entry:', error);
    return NextResponse.json(
      { error: 'Failed to initialize account entry' },
      { status: 500 },
    );
  }
}
