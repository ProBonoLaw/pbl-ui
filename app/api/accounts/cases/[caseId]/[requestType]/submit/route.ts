'use server';
import { logger } from '@/lib/logger';

import {
  internalServerErrorResponse,
  unauthorizedResponse,
} from '@/lib/apiResponses';
import { getAccountInfo } from '@/lib/accountInfo';
import { requireUserCaseAccess, UserAccessError } from '@/lib/userAccess';
import { validateTokenOrNull } from '@/lib/validateToken';
import { EventHubProducerClient, MessagingError } from '@azure/event-hubs';
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

const REQUEST_TYPE_CONFIG = {
  declarations: {
    eventType: 'declaration',
    requiredFeature: 'canGenerateDeclaration' as const,
    successMessage: 'Declaration request submitted successfully.',
    contentType: undefined,
  },
  'argument-builder': {
    eventType: 'argument-builder',
    requiredFeature: 'canGenerateDeclaration' as const,
    successMessage: 'Argument builder request submitted successfully.',
    contentType: undefined,
  },
  timeline: {
    eventType: 'timeline-builder',
    requiredFeature: 'canGenerateDeclaration' as const,
    successMessage: 'Timeline builder request submitted successfully.',
    contentType: 'application/json',
  },
} as const;

type RequestTypeSlug = keyof typeof REQUEST_TYPE_CONFIG;

type RequestTypeConfig = (typeof REQUEST_TYPE_CONFIG)[RequestTypeSlug];

type SubmitRequestBody = {
  sessionId?: string;
  requestText?: string;
  declarationRequestText?: string;
};

function normalizeRequestText(body: SubmitRequestBody): string | null {
  const { requestText, declarationRequestText } = body;
  const raw = requestText ?? declarationRequestText;
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/cases/[caseId]/[requestType]/submit'>,
) {
  const { caseId, requestType } = await ctx.params;

  if (!caseId) {
    return NextResponse.json(
      { error: 'Missing caseId parameter' },
      { status: 400 },
    );
  }
  if (!requestType || !(requestType in REQUEST_TYPE_CONFIG)) {
    return NextResponse.json(
      { error: 'Unsupported request type' },
      { status: 404 },
    );
  }

  const config: RequestTypeConfig =
    REQUEST_TYPE_CONFIG[requestType as RequestTypeSlug];

  logger.info(
    `POST /api/accounts/cases/[caseId]/${requestType}/submit for caseId:`,
    caseId,
  );

  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) {
    return unauthorizedResponse();
  }

  let payload: Awaited<ReturnType<typeof validateTokenOrNull>>;
  try {
    payload = await validateTokenOrNull(
      token,
      `POST /api/accounts/cases/[caseId]/${requestType}/submit`,
    );
  } catch (error) {
    logger.error(
      `Token validation infrastructure failure during POST /api/accounts/cases/[caseId]/${requestType}/submit:`,
      error,
    );
    return internalServerErrorResponse();
  }
  if (!payload) {
    return unauthorizedResponse('Invalid or missing token');
  }

  let requestBody: SubmitRequestBody | null = null;
  try {
    requestBody = (await request.json()) as SubmitRequestBody;
  } catch (error) {
    logger.warn(
      `Invalid JSON body for POST /api/accounts/cases/[caseId]/${requestType}/submit:`,
      error,
    );
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const inputText = normalizeRequestText(requestBody ?? {});
  const sessionId = requestBody?.sessionId;

  if (!inputText) {
    return NextResponse.json(
      { error: 'Missing or empty requestText' },
      { status: 400 },
    );
  }

  try {
    const oid = payload.oid as string;
    await requireUserCaseAccess(oid, caseId, {
      requireIsActive: true,
      allowInactiveGuestAccess: true,
      requiredFeature: config.requiredFeature,
    });

    const producerClient = new EventHubProducerClient(
      process.env.AZURE_EVENT_HUB_CONNECTION_STRING!,
      process.env.AZURE_EVENT_REQUESTS_HUB_NAME!,
    );

    const account = await getAccountInfo(caseId);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const eventMessageId = randomUUID();

    try {
      await producerClient.sendBatch(
        [
          {
            body: {
              type: config.eventType,
              oid,
              accountId: caseId,
              sessionId,
              input: inputText,
              communicationPreferences: {
                email: false,
                sms: false,
              },
            },
            messageId: eventMessageId,
            ...(config.contentType ? { contentType: config.contentType } : {}),
          },
        ],
        { partitionKey: sessionId },
      );
    } finally {
      try {
        await producerClient.close();
      } catch (error) {
        logger.error(
          `Failed to close EventHub producer for ${config.eventType} submit:`,
          error,
        );
      }
    }

    return NextResponse.json(
      { message: config.successMessage, messageId: eventMessageId },
      { status: 200 },
    );
  } catch (e) {
    if (e instanceof UserAccessError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status },
      );
    }
    if (e instanceof MessagingError) {
      logger.error('MessagingError occurred:', e.cause, e.message);
      return NextResponse.json(
        { error: 'Unable to send request.  Please try back later.' },
        { status: 500 },
      );
    }
    logger.error('Error occurred:', e);
    return internalServerErrorResponse();
  }
}
