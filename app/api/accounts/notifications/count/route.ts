import { logger } from '@/lib/logger';
import {
  internalServerErrorResponse,
  unauthorizedResponse,
} from '@/lib/apiResponses';
import { getCosmosContainer } from '@/lib/cosmos';
import { validateTokenOrNull } from '@/lib/validateToken';
import { SqlQuerySpec } from '@azure/cosmos';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const notificationType = request.nextUrl.searchParams.get('notificationType');
  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) {
    return unauthorizedResponse();
  }

  let payload: Awaited<ReturnType<typeof validateTokenOrNull>>;
  try {
    payload = await validateTokenOrNull(
      token,
      'GET /api/accounts/notifications/count',
    );
  } catch (error) {
    logger.error(
      'Token validation infrastructure failure during GET /api/accounts/notifications/count:',
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
      'SELECT VALUE COUNT(1) from c WHERE c.oid = @oid and (IS_DEFINED(c.read) = false OR c.read = false) AND (NOT IS_DEFINED(c.deleted) OR IS_NULL(c.deleted) OR c.deleted = false)';
    const parameters = [{ name: '@oid', value: oid }];
    if (notificationType) {
      baseQuery += ' AND c.notificationType = @notificationType';
      parameters.push({ name: '@notificationType', value: notificationType });
    }

    const querySpec: SqlQuerySpec = {
      query: baseQuery,
      parameters,
    };

    const queryResult = container.items.query(querySpec);
    const { resources: items } = await queryResult.fetchAll();

    return NextResponse.json({ count: items[0] }, { status: 200 });
  } catch (error) {
    logger.error('Failed to fetch notification count:', error);
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  }
}
