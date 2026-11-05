import { findClientFeedbackRequest } from '@/lib/clientFeedbackRequests';
import { fetchFeedbackSharePointFile } from '@/lib/feedbackSharePoint';
import { decodeFeedbackTranscriptEnvelope } from '@/lib/feedbackTranscript';
import {
  internalServerErrorResponse,
  unauthorizedResponse,
} from '@/lib/apiResponses';
import { logger } from '@/lib/logger';
import { requireUserCaseAccess, UserAccessError } from '@/lib/userAccess';
import { validateTokenOrNull } from '@/lib/validateToken';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/cases/[caseId]/feedback-requests/[requestId]/asset'>,
) {
  const { caseId, requestId } = await ctx.params;
  const asset = request.nextUrl.searchParams.get('asset');
  if (asset !== 'markdown' && asset !== 'media') {
    return NextResponse.json(
      { error: 'asset must be markdown or media' },
      { status: 400 },
    );
  }

  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) {
    return unauthorizedResponse();
  }

  try {
    const payload = await validateTokenOrNull(
      token,
      'GET /api/accounts/cases/[caseId]/feedback-requests/[requestId]/asset',
    );
    const oid = payload?.oid;
    if (typeof oid !== 'string' || oid.length === 0) {
      return unauthorizedResponse();
    }
    await requireUserCaseAccess(oid, caseId, {
      requireIsActive: true,
      allowInactiveGuestAccess: true,
      requiredFeature: 'canAccessDocuments',
    });

    const feedbackRequest = await findClientFeedbackRequest(caseId, requestId);
    if (!feedbackRequest) {
      return NextResponse.json(
        { error: 'Feedback request not found' },
        { status: 404 },
      );
    }

    const sharePointResponse = await fetchFeedbackSharePointFile({
      incoming: token,
      accountId: caseId,
      reference:
        asset === 'markdown'
          ? {
              itemId: feedbackRequest.markdownSourceId,
              uniqueId: feedbackRequest.markdownUniqueId,
            }
          : {
              itemId: feedbackRequest.sourceId,
              uniqueId: feedbackRequest.identifier,
            },
    });
    if (!sharePointResponse.ok || !sharePointResponse.body) {
      logger.error(
        'Failed to fetch feedback asset from SharePoint:',
        sharePointResponse.status,
        await sharePointResponse.text().catch(() => ''),
      );
      return NextResponse.json(
        { error: 'Unable to retrieve the feedback asset.' },
        { status: 502 },
      );
    }

    if (asset === 'markdown') {
      try {
        const transcript = decodeFeedbackTranscriptEnvelope(
          await sharePointResponse.text(),
        );
        return new NextResponse(transcript, {
          headers: {
            'Cache-Control': 'no-store',
            'Content-Type': 'text/markdown; charset=utf-8',
          },
        });
      } catch (error) {
        logger.error('Failed to decode feedback transcript:', error);
        return NextResponse.json(
          { error: 'Unable to decode the feedback transcript.' },
          { status: 502 },
        );
      }
    }

    return new NextResponse(sharePointResponse.body, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type':
          sharePointResponse.headers.get('content-type') ??
          'application/octet-stream',
      },
    });
  } catch (error) {
    if (error instanceof UserAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    logger.error('Failed to fetch feedback asset:', error);
    return internalServerErrorResponse();
  }
}
