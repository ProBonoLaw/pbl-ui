import { logger } from '@/lib/logger';
import { getAccountInfo } from '@/lib/accountInfo';
import { getCosmosContainer } from '@/lib/cosmos';
import { UnauthorizedError } from '@/lib/types';
import { requireUserAccess, UserAccessError } from '@/lib/userAccess';
import {
  CaseMap,
  isCaseAccountVisible,
  parseLLMUsageArray,
  UserAccountModel,
} from '@/lib/types';
import { validateRequestToken } from '@/lib/validateToken';
import { SqlQuerySpec } from '@azure/cosmos';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const payload = await validateRequestToken(request);
    const oid = payload.oid as string;
    await requireUserAccess(oid, { requireAgreedToTerms: true });

    const container = getCosmosContainer();
    const querySpec: SqlQuerySpec = {
      query:
        'SELECT * from c WHERE c.accountId = @accountId AND array_contains(c.oids, @oids)',
      parameters: [
        { name: '@accountId', value: '00000000-0000-0000-0000-000000000000' },
        { name: '@oids', value: oid },
      ],
    };

    const { resources: items } = await container.items
      .query(querySpec)
      .fetchAll();
    if (items.length === 0) {
      return NextResponse.json(
        { error: 'No accounts found for this user' },
        { status: 403 },
      );
    }
    const userAccounts = items.map((x) => UserAccountModel.parse(x));
    const billableCases =
      userAccounts
        .flatMap((userAccount) => userAccount.casesAccounts ?? [])
        .filter((caseAccount) => isCaseAccountVisible(caseAccount))
        ?.filter((caseAccount) => caseAccount?.billingCode)
        .map((caseAccount) => ({
          accountId: caseAccount.accountId,
          billingCode: caseAccount.billingCode,
        })) || [];

    if (billableCases.length === 0) {
      return NextResponse.json(
        { error: 'No billable cases found for this user' },
        { status: 404 },
      );
    }
    const billableCaseIds = billableCases
      .map((c) => c.accountId)
      .filter(
        (accountId): accountId is string =>
          accountId !== undefined && accountId !== null,
      );

    const querySpec2: SqlQuerySpec = {
      query: `
    SELECT
      c.accountId,
      c.model,
      c.llmType,
      c.origin,
      SUM(c.inputTokens)  AS inputTokens,
      SUM(c.outputTokens) AS outputTokens,
      SUM(c.reasoningTokens) AS reasoningTokens,
      SUM(c.totalTokens)  AS totalTokens
    FROM c
    WHERE ARRAY_CONTAINS(@accountIds, c.accountId)
    GROUP BY c.accountId, c.model, c.llmType, c.origin
  `,
      parameters: [{ name: '@accountIds', value: billableCaseIds }],
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

    const llmUsageForCases = parseLLMUsageArray(accountUsage);

    await Promise.all(
      userAccounts.map(async (account) => {
        await Promise.all(
          (account.casesAccounts ?? [])
            .filter((caseAccount) => isCaseAccountVisible(caseAccount))
            .map(async (caseAccount) => {
              if (!caseAccount?.accountId) return;

              const usageForCase = llmUsageForCases.filter(
                (usage) => usage.accountId === caseAccount.accountId,
              );

              caseAccount.llmUsage = usageForCase;

              const record = await getAccountInfo(caseAccount.accountId);
              caseAccount.record = record?.data;
            }),
        );
      }),
    );

    const userCaseMap: CaseMap[] = userAccounts
      .flatMap((account) => account.casesAccounts ?? [])
      .filter((caseAccount) => isCaseAccountVisible(caseAccount))
      .filter((caseAccount) => !!caseAccount.billingCode);

    return NextResponse.json(userCaseMap, { status: 200 });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: 'Invalid or missing token' },
        { status: 401 },
      );
    }
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
