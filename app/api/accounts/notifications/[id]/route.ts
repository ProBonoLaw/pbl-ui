import { logger } from '@/lib/logger';
import {
  internalServerErrorResponse,
  unauthorizedResponse,
} from '@/lib/apiResponses';
import { getCosmosContainer } from '@/lib/cosmos';
import { validateTokenOrNull } from '@/lib/validateToken';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/notifications/[id]'>,
) {
  const { id } = await ctx.params;
  const notificationType = request.nextUrl.searchParams.get('notificationType');
  if (!notificationType) {
    return NextResponse.json(
      { error: 'notificationType query parameter is required' },
      { status: 400 },
    );
  }

  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) {
    return unauthorizedResponse();
  }

  let payload: Awaited<ReturnType<typeof validateTokenOrNull>>;
  try {
    payload = await validateTokenOrNull(
      token,
      'PUT /api/accounts/notifications/[id]',
    );
  } catch (error) {
    logger.error(
      'Token validation infrastructure failure during PUT /api/accounts/notifications/[id]:',
      error,
    );
    return internalServerErrorResponse();
  }
  if (!payload) {
    return unauthorizedResponse('Invalid or missing token');
  }

  try {
    const oid = payload.oid as string;
    const container = getCosmosContainer(
      process.env.COSMOS_SQL_NOTIFICATIONS_CONTAINER,
    );
    logger.info('Updating notification with id:', id, 'for oid:', oid);
    const response = await container.item(id, [oid, notificationType]).patch({
      operations: [
        {
          op: 'add',
          path: '/readAt',
          value: new Date(),
        },
        {
          op: 'set',
          path: '/read',
          value: true,
        },
      ],
    });

    if (response.statusCode > 299) {
      logger.error('Failed to update notification:', response);
      return NextResponse.json(
        { error: 'Failed to update notification' },
        { status: response.statusCode },
      );
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    logger.error('Error updating notification:', error);
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/notifications/[id]'>,
) {
  const { id } = await ctx.params;
  const notificationType = request.nextUrl.searchParams.get('notificationType');
  if (!notificationType) {
    return NextResponse.json(
      { error: 'notificationType query parameter is required' },
      { status: 400 },
    );
  }

  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) {
    return unauthorizedResponse();
  }

  let payload: Awaited<ReturnType<typeof validateTokenOrNull>>;
  try {
    payload = await validateTokenOrNull(
      token,
      'DELETE /api/accounts/notifications/[id]',
    );
  } catch (error) {
    logger.error(
      'Token validation infrastructure failure during DELETE /api/accounts/notifications/[id]:',
      error,
    );
    return internalServerErrorResponse();
  }
  if (!payload) {
    return unauthorizedResponse('Invalid or missing token');
  }

  try {
    const oid = payload.oid as string;
    const container = getCosmosContainer(
      process.env.COSMOS_SQL_NOTIFICATIONS_CONTAINER,
    );
    logger.info('Soft deleting notification with id:', id, 'for oid:', oid);
    const response = await container.item(id, [oid, notificationType]).patch({
      operations: [
        {
          op: 'set',
          path: '/deleted',
          value: true,
        },
      ],
    });

    if (response.statusCode > 299) {
      logger.error('Failed to soft delete notification:', response);
      return NextResponse.json(
        { error: 'Failed to soft delete notification' },
        { status: response.statusCode },
      );
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    logger.error('Error while soft deleting notification:', error);
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  }
}
