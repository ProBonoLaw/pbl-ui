'use server';

import {
  internalServerErrorResponse,
  unauthorizedResponse,
} from '@/lib/apiResponses';
import { fetchWithTrace } from '@/lib/apiTracing';
import { logger } from '@/lib/logger';
import {
  parseTimelineResult,
  TimelineBuildRequestSchema,
  UnauthorizedError,
} from '@/lib/types';
import { requireUserCaseAccess, UserAccessError } from '@/lib/userAccess';
import { validateTokenOrNull } from '@/lib/validateToken';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  ctx: { params: Promise<{ caseId: string }> },
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

  const timelineUrl = process.env.AIMIE_REALTIME_TIMELINE_URL;
  const subscriptionKey = process.env.AIMIE_REALTIME_TIMELINE_SUBSCRIPTION_KEY;
  if (!timelineUrl || !subscriptionKey) {
    logger.error('Timeline service URL or subscription key is not configured');
    return NextResponse.json(
      { error: 'Timeline service is not configured' },
      { status: 500 },
    );
  }

  try {
    const jwtPayload = await validateTokenOrNull(
      token,
      'POST /api/accounts/cases/[caseId]/timeline',
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
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const timelineRequest = TimelineBuildRequestSchema.parse(body);

    await requireUserCaseAccess(oid, caseId, {
      requireIsActive: true,
      allowInactiveGuestAccess: true,
      requiredFeature: 'canGenerateDeclaration',
    });

    const response = await fetchWithTrace(timelineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': subscriptionKey,
      },
      body: JSON.stringify({ ...timelineRequest, accountId: caseId }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        'Timeline service error:',
        response.status,
        response.statusText,
        errorText,
      );
      return NextResponse.json(
        { error: 'Timeline service error' },
        { status: 502 },
      );
    }

    const payload: unknown = await response.json();
    const timeline = parseTimelineResult(payload);
    if (!timeline) {
      logger.error('Timeline service returned an invalid response');
      return NextResponse.json(
        { error: 'Timeline service returned an invalid response' },
        { status: 502 },
      );
    }

    return NextResponse.json({ data: timeline });
  } catch (error) {
    if (error instanceof UserAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse('Invalid or missing token');
    }
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid timeline request' }, { status: 400 });
    }
    logger.error('Error processing timeline request:', error);
    return internalServerErrorResponse();
  }
}
