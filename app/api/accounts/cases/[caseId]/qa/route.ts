'use server';
import { logger } from '@/lib/logger';

import {
  internalServerErrorResponse,
  unauthorizedResponse,
} from '@/lib/apiResponses';
import { fetchWithTrace } from '@/lib/apiTracing';
import {
  QAComment,
  QACommentModel,
  QAInteractionSlimModel,
  UnauthorizedError,
} from '@/lib/types';
import { requireUserCaseAccess, UserAccessError } from '@/lib/userAccess';
import { validateTokenOrNull } from '@/lib/validateToken';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  ctx: RouteContext<'/api/accounts/cases/[caseId]/qa'>,
) {
  const { caseId } = await ctx.params;
  if (!caseId) {
    return NextResponse.json(
      { error: 'Missing caseId parameter' },
      { status: 400 },
    );
  }
  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) {
    return unauthorizedResponse();
  }

  const opcApimSubscriptionKey = process.env.AIMIE_QA_SUBSCRIPTION_KEY;
  const qaUrl = process.env.AIMIE_QA_URL;
  if (!opcApimSubscriptionKey || !qaUrl) {
    logger.error('Missing Subscription Key or QA URL in environment variables');
    return NextResponse.json(
      { error: 'Server configuration error!' },
      { status: 500 },
    );
  }
  const formattingUrl = process.env.AIMIE_QA_FORMATTING_URL;
  const formattingKey = process.env.AIMIE_QA_KEY;
  if (!formattingUrl || !formattingKey) {
    logger.error(
      'Missing Formatting Service URL or Key in environment variables',
    );
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 },
    );
  }
  try {
    const jwtPayload = await validateTokenOrNull(
      token,
      'POST /api/accounts/cases/[caseId]/qa',
    );
    if (!jwtPayload) {
      throw new UnauthorizedError('Invalid token');
    }

    const oid = jwtPayload.oid as string | undefined;
    if (!oid) {
      throw new UnauthorizedError('Missing oid claim');
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn(
        'Invalid JSON body for POST /api/accounts/cases/[caseId]/qa:',
        error,
      );
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    await requireUserCaseAccess(oid, caseId, {
      requireIsActive: true,
      allowInactiveGuestAccess: true,
      requiredFeature: 'canUseQA',
    });

    const qaRequest: QAComment = QACommentModel.parse(body);
    qaRequest.accountId = caseId;
    qaRequest.provideThoroughResponse = false;
    const response = await fetchWithTrace(qaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': opcApimSubscriptionKey,
      },
      body: JSON.stringify(qaRequest),
    });
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        'QA service error:',
        response.status,
        response.statusText,
        errorText,
      );
      return NextResponse.json(
        { error: 'QA service error', details: errorText },
        { status: 500 },
      );
    }
    const data = await response.json();
    const formattingRequest = {
      document: data.answer,
      context: data.context,
      accountId: caseId,
    };

    const conditioningResponse = await fetchWithTrace(formattingUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': formattingKey,
      },
      body: JSON.stringify(formattingRequest),
    });
    const formattedResponse = await conditioningResponse.json();
    const adjustedResponse = QAInteractionSlimModel.parse(formattedResponse);

    return new Response(JSON.stringify({ data: adjustedResponse.data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    if (e instanceof UserAccessError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status },
      );
    }
    if (e instanceof UnauthorizedError) {
      return unauthorizedResponse('Invalid or missing token');
    }
    logger.error('Error processing request:', e);
    return internalServerErrorResponse();
  }
}
