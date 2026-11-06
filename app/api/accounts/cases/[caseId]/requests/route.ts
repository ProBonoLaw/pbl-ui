import { logger } from '@/lib/logger';
import {
  internalServerErrorResponse,
  unauthorizedResponse,
} from '@/lib/apiResponses';
import { getCosmosContainer } from '@/lib/cosmos';
import { parseRequestDataArray } from '@/lib/types';
import { parseRequestSummaries, REQUEST_SUMMARY_SELECT } from '@/lib/requestSummaries';
import { requireUserCaseAccess, UserAccessError } from '@/lib/userAccess';
import { validateTokenOrNull } from '@/lib/validateToken';
import { SqlQuerySpec } from '@azure/cosmos';
import { NextRequest, NextResponse } from 'next/server';

const TIMELINE_REQUEST_TYPE = 'timeline-builder';

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/cases/[caseId]/requests'>,
) {
  const { caseId } = await ctx.params;

  const requestType = request.nextUrl.searchParams.get('requestType');
  const status = request.nextUrl.searchParams.get('status');
  const summaryOnly = requestType === 'argument-builder' || requestType === 'declaration';

  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) {
    return unauthorizedResponse();
  }

  let payload: Awaited<ReturnType<typeof validateTokenOrNull>>;
  try {
    payload = await validateTokenOrNull(
      token,
      'GET /api/accounts/cases/[caseId]/requests',
    );
  } catch (error) {
    logger.error(
      'Token validation infrastructure failure during GET /api/accounts/cases/[caseId]/requests:',
      error,
    );
    return internalServerErrorResponse();
  }
  if (!payload) {
    return unauthorizedResponse('Invalid or missing token');
  }
  const oid = payload.oid as string;

  let canReadGeneratedRequests = summaryOnly || requestType === TIMELINE_REQUEST_TYPE;
  try {
    await requireUserCaseAccess(oid, caseId, {
      requireIsActive: true,
      allowInactiveGuestAccess: true,
    });

    if (summaryOnly || requestType === TIMELINE_REQUEST_TYPE) {
      await requireUserCaseAccess(oid, caseId, {
        requireIsActive: true,
        allowInactiveGuestAccess: true,
        requiredFeature: 'canGenerateDeclaration',
      });
    } else if (!requestType) {
      try {
        await requireUserCaseAccess(oid, caseId, {
          requireIsActive: true,
          allowInactiveGuestAccess: true,
          requiredFeature: 'canGenerateDeclaration',
        });
        canReadGeneratedRequests = true;
      } catch (error) {
        if (!(error instanceof UserAccessError)) {
          throw error;
        }
      }
    }
  } catch (error) {
    if (error instanceof UserAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    logger.error('Error authorizing request list access:', error);
    return internalServerErrorResponse();
  }

  const container = getCosmosContainer(
    process.env.COSMOS_SQL_REQUESTS_CONTAINER!,
  );
  let baseQuery =
    `SELECT ${summaryOnly ? REQUEST_SUMMARY_SELECT : '*'} FROM c WHERE c.accountId = @accountId AND c.oid = @oid`;
  const parameters = [
    { name: '@accountId', value: caseId },
    { name: '@oid', value: oid },
  ];
  if (requestType) {
    baseQuery += ' AND c.type = @type';
    parameters.push({ name: '@type', value: requestType });
  } else if (!canReadGeneratedRequests) {
    baseQuery += ' AND c.type != @timelineRequestType';
    parameters.push({ name: '@timelineRequestType', value: TIMELINE_REQUEST_TYPE });
    baseQuery += ' AND c.type != @argumentRequestType AND c.type != @declarationRequestType';
    parameters.push(
      { name: '@argumentRequestType', value: 'argument-builder' },
      { name: '@declarationRequestType', value: 'declaration' },
    );
  }
  if (status) {
    baseQuery += ' AND c.status = @status';
    parameters.push({ name: '@status', value: status });
  }
  const querySpec: SqlQuerySpec = {
    query: baseQuery,
    parameters,
  };

  const { resources: items } = await container.items
    .query(querySpec)
    .fetchAll();

  if (items.length === 0) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  return NextResponse.json(
    summaryOnly ? parseRequestSummaries(items) : parseRequestDataArray(items),
    { status: 200 },
  );
}
