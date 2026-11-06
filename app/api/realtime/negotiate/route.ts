import { logger } from "@/lib/logger";
import { UnauthorizedError } from '@/lib/types';
import { validateRequestToken } from '@/lib/validateToken';
import { WebPubSubServiceClient } from '@azure/web-pubsub';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function getWebPubSubClient() {
  const hub = process.env.WEB_PUBSUB_HUB;
  const conn = process.env.WEB_PUBSUB_CONNECTION_STRING;

  if (!hub) {
    throw new Error('WEB_PUBSUB_HUB env var is not set');
  }
  if (!conn) {
    throw new Error('WEB_PUBSUB_CONNECTION_STRING env var is not set');
  }

  return new WebPubSubServiceClient(conn, hub);
}

export async function POST(request: NextRequest) {
  try {
    const payload = await validateRequestToken(request);
    const oid = payload.oid as string;
    const groupName = 'USER_' + oid;

    const svc = getWebPubSubClient();
    // Receive-only: allow joining a group, but DO NOT grant send roles
    const token = await svc.getClientAccessToken({
      groups: [groupName],
      roles: ['webpubsub.joinLeaveGroup'], // or "webpubsub.joinLeaveGroup.notifications"
      expirationTimeInMinutes: 60,
    });

    return Response.json({ url: token.url, oid, groupName });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    logger.error('Failed to negotiate WebPubSub token:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
