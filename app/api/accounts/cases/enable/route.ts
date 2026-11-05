import { logger } from '@/lib/logger';
import { ACCOUNT_OPERATIONS_HUB_NAME } from '@/lib/accountOperationsEventHub';
import { getCosmosContainer } from '@/lib/cosmos';
import { getSharePointGrantAccessLevel } from '@/lib/sharePointAccess';
import { StoredUserAccountsSchema, UnauthorizedError } from '@/lib/types';
import { validateRequestToken } from '@/lib/validateToken';
import { SqlQuerySpec } from '@azure/cosmos';
import { EventHubProducerClient } from '@azure/event-hubs';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const eventHubConnectionString =
      process.env.AZURE_EVENT_HUB_CONNECTION_STRING!;
    const payload = await validateRequestToken(request);
    const oid = payload.oid as string;

    let emailAddress: string;
    try {
      ({ emailAddress } = (await request.json()) as { emailAddress: string });
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const container = getCosmosContainer();
    const querySpec: SqlQuerySpec = {
      query:
        'SELECT * from c WHERE c.accountId = @accountId AND (array_contains(c.oids, @oid) OR array_contains(c.emailAddresses, @emailAddress))',
      parameters: [
        { name: '@accountId', value: '00000000-0000-0000-0000-000000000000' },
        { name: '@oid', value: oid },
        { name: '@emailAddress', value: emailAddress },
      ],
    };

    const { resources: items } = await container.items
      .query(querySpec)
      .fetchAll();
    if (items.length === 0) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const refinedItems = StoredUserAccountsSchema.parse(items);

    const producer = new EventHubProducerClient(
      eventHubConnectionString,
      ACCOUNT_OPERATIONS_HUB_NAME,
    );

    try {
      let batch = await producer.createBatch();
      for (const item of refinedItems) {
        if (!item.oids.includes(oid)) {
          item.oids.push(oid);
          await container.items.upsert(item);
          for (const ca of item.casesAccounts) {
            const accessLevel = getSharePointGrantAccessLevel(ca);
            if (!accessLevel) {
              continue;
            }

            const event = {
              body: {
                eventKind: 'SharePointAccessGrant',
                accountId: ca.accountId,
                recipient: {
                  emailAddress: emailAddress,
                  oid: oid,
                },
                accessLevel,
              },
            };

            if (!batch.tryAdd(event)) {
              await producer.sendBatch(batch);
              batch = await producer.createBatch();

              if (!batch.tryAdd(event)) {
                return NextResponse.json(
                  { error: 'Event payload too large to enqueue' },
                  { status: 413 },
                );
              }
            }
          }
        }
      }

      if (batch.count > 0) {
        await producer.sendBatch(batch);
      }
    } finally {
      try {
        await producer.close();
      } catch (error) {
        logger.error('Failed to close enable route EventHub producer:', error);
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: 'Invalid or missing token' },
        { status: 401 },
      );
    }
    logger.error('Error enabling accounts:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
