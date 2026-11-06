import { logger } from '@/lib/logger';
import { stripCosmosSystemProperties } from '@/lib/types';
import {
  internalServerErrorResponse,
  unauthorizedResponse,
} from '@/lib/apiResponses';
import { getCosmosContainer } from '@/lib/cosmos';
import { validateTokenOrNull } from '@/lib/validateToken';
import { BulkOperationType, OperationInput, SqlQuerySpec } from '@azure/cosmos';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const notificationType = request.nextUrl.searchParams.get('notificationType');
  const includeDeletedParam =
    request.nextUrl.searchParams.get('includeDeleted');
  const includeDeleted = includeDeletedParam === 'true';
  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) {
    return unauthorizedResponse();
  }

  let payload: Awaited<ReturnType<typeof validateTokenOrNull>>;
  try {
    payload = await validateTokenOrNull(
      token,
      'GET /api/accounts/notifications',
    );
  } catch (error) {
    logger.error(
      'Token validation infrastructure failure during GET /api/accounts/notifications:',
      error,
    );
    return internalServerErrorResponse();
  }
  if (!payload) {
    return unauthorizedResponse();
  }

  try {
    const oid = payload.oid as string;
    const container = getCosmosContainer(
      process.env.COSMOS_SQL_NOTIFICATIONS_CONTAINER,
    );
    let baseQuery = 'SELECT * from c WHERE c.oid = @oid';
    const parameters = [{ name: '@oid', value: oid }];
    if (!includeDeleted) {
      baseQuery +=
        ' AND (NOT IS_DEFINED(c.deleted) OR IS_NULL(c.deleted) OR c.deleted = false)';
    }
    if (notificationType) {
      baseQuery += ' AND c.notificationType = @notificationType';
      parameters.push({ name: '@notificationType', value: notificationType });
    }

    const querySpec: SqlQuerySpec = {
      query: baseQuery,
      parameters,
    };
    const { resources: items } = await container.items
      .query(querySpec)
      .fetchAll();

    return NextResponse.json(
      { data: items.map(stripCosmosSystemProperties) },
      { status: 200 },
    );
  } catch (error) {
    logger.error('Failed to fetch notifications:', error);
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const notificationType = request.nextUrl.searchParams.get('notificationType');
  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) {
    return unauthorizedResponse();
  }

  let payload: Awaited<ReturnType<typeof validateTokenOrNull>>;
  try {
    payload = await validateTokenOrNull(
      token,
      'DELETE /api/accounts/notifications',
    );
  } catch (error) {
    logger.error(
      'Token validation infrastructure failure during DELETE /api/accounts/notifications:',
      error,
    );
    return internalServerErrorResponse();
  }
  if (!payload) {
    return unauthorizedResponse();
  }

  try {
    const oid = payload.oid as string;
    const container = getCosmosContainer(
      process.env.COSMOS_SQL_NOTIFICATIONS_CONTAINER,
    );

    let baseQuery =
      'SELECT c.id, c.notificationType from c WHERE c.oid = @oid AND (NOT IS_DEFINED(c.deleted) OR IS_NULL(c.deleted) OR c.deleted = false)';
    const parameters = [{ name: '@oid', value: oid }];
    if (notificationType) {
      baseQuery += ' AND c.notificationType = @notificationType';
      parameters.push({ name: '@notificationType', value: notificationType });
    }

    const querySpec: SqlQuerySpec = {
      query: baseQuery,
      parameters,
    };

    const { resources: items } = await container.items
      .query<{ id: string; notificationType: string }>(querySpec)
      .fetchAll();

    if (!items.length) {
      return new Response(null, { status: 204 });
    }

    const operationsByType = new Map<string, string[]>();
    for (const item of items) {
      const ids = operationsByType.get(item.notificationType) ?? [];
      ids.push(item.id);
      operationsByType.set(item.notificationType, ids);
    }

    for (const [typeKey, ids] of operationsByType.entries()) {
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const operations: OperationInput[] = chunk.map((id) => ({
          operationType: BulkOperationType.Patch,
          id,
          resourceBody: {
            operations: [
              {
                op: 'set',
                path: '/deleted',
                value: true,
              },
            ],
          },
        }));

        const response = await container.items.batch(operations, [
          oid,
          typeKey,
        ]);
        const failure = response.result?.find((op) => op.statusCode > 299);
        if (failure) {
          logger.error('Failed to soft delete notifications:', failure);
          return NextResponse.json(
            { error: 'Failed to soft delete notifications' },
            { status: failure.statusCode ?? 500 },
          );
        }
      }
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    logger.error('Error while soft deleting notifications:', error);
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  }
}
