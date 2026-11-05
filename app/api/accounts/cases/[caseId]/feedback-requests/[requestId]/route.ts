import {
  completeSpeakerNameFeedback,
  findClientFeedbackRequest,
  setClientFeedbackRequestStatus,
} from '@/lib/clientFeedbackRequests';
import {
  internalServerErrorResponse,
  unauthorizedResponse,
} from '@/lib/apiResponses';
import {
  FileIngestionSubmissionError,
  requestFileIngestion,
} from '@/lib/fileIngestionEvent';
import { createFileIngestionRequest } from '@/lib/fileIngestionRequest';
import { logger } from '@/lib/logger';
import { SpeakerNameFeedbackResponseSchema } from '@/lib/types';
import { requireUserCaseAccess, UserAccessError } from '@/lib/userAccess';
import { validateTokenOrNull } from '@/lib/validateToken';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const CompleteSpeakerNameFeedbackSchema = z
  .object({ response: SpeakerNameFeedbackResponseSchema })
  .strict();

async function authorizeFeedbackRequest(
  request: NextRequest,
  caseId: string,
  operation: string,
) {
  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) {
    return null;
  }

  const payload = await validateTokenOrNull(token, operation);
  const oid = payload?.oid;
  if (typeof oid !== 'string' || oid.length === 0) {
    return null;
  }

  await requireUserCaseAccess(oid, caseId, {
    requireIsActive: true,
    allowInactiveGuestAccess: true,
    requiredFeature: 'canAccessDocuments',
  });

  return token;
}

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/cases/[caseId]/feedback-requests/[requestId]'>,
) {
  const { caseId, requestId } = await ctx.params;

  try {
    const token = await authorizeFeedbackRequest(
      request,
      caseId,
      'GET /api/accounts/cases/[caseId]/feedback-requests/[requestId]',
    );
    if (!token) {
      return unauthorizedResponse();
    }

    const feedbackRequest = await findClientFeedbackRequest(caseId, requestId);
    if (!feedbackRequest) {
      return NextResponse.json(
        { error: 'Feedback request not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(feedbackRequest, { status: 200 });
  } catch (error) {
    if (error instanceof UserAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    logger.error('Failed to get feedback request:', error);
    return internalServerErrorResponse();
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/cases/[caseId]/feedback-requests/[requestId]'>,
) {
  const { caseId, requestId } = await ctx.params;

  try {
    const token = await authorizeFeedbackRequest(
      request,
      caseId,
      'PATCH /api/accounts/cases/[caseId]/feedback-requests/[requestId]',
    );
    if (!token) {
      return unauthorizedResponse();
    }

    const body = CompleteSpeakerNameFeedbackSchema.safeParse(
      await request.json(),
    );
    if (!body.success) {
      return NextResponse.json(
        { error: 'A non-empty name is required for every speaker.' },
        { status: 400 },
      );
    }

    const feedbackRequest = await findClientFeedbackRequest(caseId, requestId);
    if (!feedbackRequest) {
      return NextResponse.json(
        { error: 'Feedback request not found' },
        { status: 404 },
      );
    }
    if (!feedbackRequest.identifier || !feedbackRequest.sourceId) {
      return NextResponse.json(
        { error: 'Feedback request requires identifier and sourceId.' },
        { status: 400 },
      );
    }

    const response = await completeSpeakerNameFeedback(
      feedbackRequest,
      body.data.response,
    );
    if (response.statusCode > 299) {
      logger.error('Failed to complete feedback request:', response);
      return NextResponse.json(
        { error: 'Unable to save feedback.' },
        { status: response.statusCode },
      );
    }

    try {
      await requestFileIngestion(
        createFileIngestionRequest({
          identifier: feedbackRequest.identifier,
          accountId: feedbackRequest.accountId,
        }),
      );
    } catch (error) {
      try {
        await setClientFeedbackRequestStatus(feedbackRequest, 'pending');
      } catch (statusError) {
        logger.error(
          'Failed to reset feedback status after file ingestion submission failure:',
          statusError,
        );
      }
      throw error;
    }

    return NextResponse.json(
      { ...feedbackRequest, response: body.data.response, status: 'completed' },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof UserAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof FileIngestionSubmissionError) {
      logger.error(
        'Feedback was saved but file ingestion could not be submitted:',
        error,
      );
      return NextResponse.json(
        {
          error:
            'Your feedback was saved, but reprocessing could not be submitted. Please try again later.',
        },
        { status: 503 },
      );
    }
    logger.error('Failed to complete feedback request:', error);
    return internalServerErrorResponse();
  }
}
