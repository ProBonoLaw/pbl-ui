import { logger } from '@/lib/logger';
import {
  internalServerErrorResponse,
  unauthorizedResponse,
} from '@/lib/apiResponses';
import { getCosmosContainer } from '@/lib/cosmos';
import {
  groupLLMUsageByOriginAndType,
  parseLLMUsageArray,
  parseQueryTimingMetricArray,
} from '@/lib/types';
import { requireUserCaseAccess, UserAccessError } from '@/lib/userAccess';
import { validateTokenOrNull } from '@/lib/validateToken';
import { SqlQuerySpec } from '@azure/cosmos';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/cases/[caseId]/usage/summary'>,
) {
  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) {
    return unauthorizedResponse();
  }

  const { caseId } = await ctx.params;
  if (!caseId) {
    return NextResponse.json(
      { error: 'Missing caseId parameter' },
      { status: 400 },
    );
  }

  const fromDate = request.nextUrl.searchParams.get('from');
  const toDate = request.nextUrl.searchParams.get('to');

  let payload: Awaited<ReturnType<typeof validateTokenOrNull>>;
  try {
    payload = await validateTokenOrNull(
      token,
      'GET /api/accounts/cases/[caseId]/usage/summary',
    );
  } catch (error) {
    logger.error(
      'Token validation infrastructure failure during GET /api/accounts/cases/[caseId]/usage/summary:',
      error,
    );
    return internalServerErrorResponse();
  }
  if (!payload) {
    return unauthorizedResponse('Invalid or missing token');
  }

  try {
    const oid = payload.oid as string;
    await requireUserCaseAccess(oid, caseId, {
      requireIsActive: true,
      allowInactiveGuestAccess: true,
    });

    const container = getCosmosContainer();
    const querySpec: SqlQuerySpec = {
      query: `SELECT
  oid    AS oid,
  email  AS email,
  cases.accountId  AS caseAccountId,
  cases.caseNumber AS caseNumber,
  cases.billingCode AS billingCode
FROM c
JOIN oid   IN c.oids
JOIN email IN c.emailAddresses
JOIN cases IN c.casesAccounts
WHERE c.accountId = '00000000-0000-0000-0000-000000000000'
AND cases.accountId = @caseId
AND IS_DEFINED(cases.billingCode)`,
      parameters: [
        { name: '@accountId', value: '00000000-0000-0000-0000-000000000000' },
        { name: '@oids', value: oid },
        { name: '@caseId', value: caseId },
      ],
    };

    const { resources: items } = await container.items
      .query(querySpec)
      .fetchAll();
    if (items.length === 0) {
      return NextResponse.json(
        {
          error: `User does not have access to this case's usage info: ${caseId} `,
        },
        { status: 403 },
      );
    }
    const userAccounts = items.map((x) => {
      return { accountId: x.caseAccountId, billingCode: x.billingCode };
    });
    const billableCases = userAccounts
      ?.filter((caseAccount) => caseAccount.billingCode)
      .map((caseAccount) => ({
        accountId: caseAccount.accountId,
        billingCode: caseAccount.billingCode,
      }))?.[0];

    if (!billableCases) {
      return NextResponse.json(
        { error: 'No billable cases found for this user' },
        { status: 404 },
      );
    }

    const billableCaseId = billableCases.accountId;
    const today = new Date();
    let start: Date;
    if (fromDate) {
      start = new Date(fromDate);
    } else if (today.getDate() > 1) {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (today.getMonth() === 0) {
      start = new Date(today.getFullYear() - 1, 11, 1);
    } else {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    }
    const endDate = toDate ? new Date(toDate) : new Date();

    const queryMetricsSpec: SqlQuerySpec = {
      query: `
    SELECT c.name, c.success, count(1) as queryCount, avg(c.duration) as timeToComplete
FROM c
WHERE c.accountId = @accountId and c.eventTs >= @fromDate and c.eventTs < @toDate
GROUP By c.name, c.success
    `,
      parameters: [
        { name: '@accountId', value: billableCaseId },
        { name: '@fromDate', value: start.toISOString() },
        { name: '@toDate', value: endDate.toISOString() },
      ],
    };

    const aimieStatsContainerName = process.env.COSMOS_DB_AIMIE_STATS_CONTAINER;
    if (!aimieStatsContainerName) {
      logger.error(
        'Environment variable COSMOS_DB_AIMIE_STATS_CONTAINER is not set',
      );
      return NextResponse.json(
        { error: 'Server misconfiguration' },
        { status: 500 },
      );
    }

    const aimieStatsContainer = getCosmosContainer(aimieStatsContainerName);
    const { resources: aimieStats } = await aimieStatsContainer.items
      .query(queryMetricsSpec)
      .fetchAll();

    const queryTimingMetrics = parseQueryTimingMetricArray(aimieStats);

    logger.info('Account usage data:', aimieStats);

    const querySpec2: SqlQuerySpec = {
      query: `
    SELECT
      c.model,
      c.llmType,
      c.origin,
      sum(c.inputTokens)  AS inputTokens,
      sum(c.outputTokens) AS outputTokens,
      sum(c.reasoningTokens) AS reasoningTokens,
      sum(c.totalTokens)  AS totalTokens
    FROM c
    WHERE c.accountId=@accountId and c.usageTs >= @fromDate and c.usageTs < @toDate
    GROUP BY c.model, c.llmType, c.origin
    ORDER BY c.origin ASC`,
      parameters: [
        { name: '@accountId', value: billableCaseId },
        { name: '@fromDate', value: start.toISOString() },
        { name: '@toDate', value: endDate.toISOString() },
      ],
    };

    const usageContainerName = process.env.COSMOS_DB_USAGE_CONTAINER;
    if (!usageContainerName) {
      logger.error('Environment variable COSMOS_DB_USAGE_CONTAINER is not set');
      return NextResponse.json(
        { error: 'Server misconfiguration' },
        { status: 500 },
      );
    }
    const usageContainer = getCosmosContainer(usageContainerName);
    const { resources: accountUsage } = await usageContainer.items
      .query(querySpec2)
      .fetchAll();

    logger.info('Account usage data:', accountUsage);

    const llmUsageForCases = parseLLMUsageArray(accountUsage);

    return NextResponse.json(
      groupLLMUsageByOriginAndType(llmUsageForCases, queryTimingMetrics),
      {
        status: 200,
      },
    );
  } catch (e) {
    if (e instanceof UserAccessError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status },
      );
    }
    logger.error('Unexpected error:', e);
    let errorType = 'InternalServerError';
    if (
      e &&
      typeof e === 'object' &&
      'name' in e &&
      typeof (e as { name?: unknown }).name === 'string'
    ) {
      errorType = (e as { name: string }).name;
    }
    return NextResponse.json(
      {
        error: 'An unexpected error occurred while fetching account usage.',
        errorType,
      },
      { status: 500 },
    );
  }
}
