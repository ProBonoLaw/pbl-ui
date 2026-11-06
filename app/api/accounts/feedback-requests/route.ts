import { listClientFeedbackRequests } from '@/lib/clientFeedbackRequests';
import { getAccountInfo } from '@/lib/accountInfo';
import { printTitle } from '@/lib/caseUtils';
import { getCosmosContainer } from '@/lib/cosmos';
import { getFeedbackSourceFilename } from '@/lib/feedbackRequestPresentation';
import {
  internalServerErrorResponse,
  unauthorizedResponse,
} from '@/lib/apiResponses';
import { logger } from '@/lib/logger';
import { isCaseAccountVisible, UserAccountModel } from '@/lib/types';
import { evaluateCaseFeaturePolicy } from '@/lib/userAccessPolicy';
import { requireUserAccess, UserAccessError } from '@/lib/userAccess';
import { validateTokenOrNull } from '@/lib/validateToken';
import { SqlQuerySpec } from '@azure/cosmos';
import { NextRequest, NextResponse } from 'next/server';

const ROOT_ACCOUNT_ID = '00000000-0000-0000-0000-000000000000';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) {
    return unauthorizedResponse();
  }

  try {
    const payload = await validateTokenOrNull(
      token,
      'GET /api/accounts/feedback-requests',
    );
    const oid = payload?.oid;
    if (typeof oid !== 'string' || oid.length === 0) {
      return unauthorizedResponse();
    }
    await requireUserAccess(oid, {
      requireAgreedToTerms: true,
      requireIsActive: true,
    });

    const accountContainer = getCosmosContainer();
    const accountQuery: SqlQuerySpec = {
      query:
        'SELECT * FROM c WHERE c.accountId = @accountId AND ARRAY_CONTAINS(c.oids, @oid)',
      parameters: [
        { name: '@accountId', value: ROOT_ACCOUNT_ID },
        { name: '@oid', value: oid },
      ],
    };
    const { resources: accounts } = await accountContainer.items
      .query(accountQuery)
      .fetchAll();
    const userAccounts = accounts.map((account) => UserAccountModel.parse(account));
    const caseAccounts = userAccounts.flatMap((account) => account.casesAccounts);
    const accessibleCaseIds = caseAccounts
      .filter(
        (caseAccount) =>
          isCaseAccountVisible(caseAccount) &&
          evaluateCaseFeaturePolicy({
            agreedToCaseTerms: caseAccount.agreedToCaseTerms === true,
            isGuest: caseAccount.isGuest === true,
            requiredFeature: 'canAccessDocuments',
            canAccessDocuments: caseAccount.canAccessDocuments,
          }).allowed,
      )
      .map((caseAccount) => caseAccount.accountId);

    const accessibleCaseIdSet = new Set(accessibleCaseIds);
    const caseHeadliners = new Map(
      caseAccounts.flatMap((caseAccount) =>
        caseAccount.record
          ? [[caseAccount.accountId, printTitle(caseAccount.record)] as const]
          : [],
      ),
    );
    await Promise.all(
      [...accessibleCaseIdSet].map(async (caseId) => {
        if (caseHeadliners.has(caseId)) {
          return;
        }
        try {
          const caseRecord = await getAccountInfo(caseId);
          caseHeadliners.set(caseId, printTitle(caseRecord?.data));
        } catch (error) {
          logger.warn(
            'Failed to load case headliner for feedback request:',
            caseId,
            error,
          );
        }
      }),
    );
    const feedbackRequests = await listClientFeedbackRequests([
      ...accessibleCaseIdSet,
    ]);
    return NextResponse.json(
      feedbackRequests
        .filter((feedbackRequest) =>
          accessibleCaseIdSet.has(feedbackRequest.accountId),
        )
        .map((feedbackRequest) => ({
          id: feedbackRequest.id,
          accountId: feedbackRequest.accountId,
          caseHeadliner:
            caseHeadliners.get(feedbackRequest.accountId) ?? 'Unavailable case',
          filename: getFeedbackSourceFilename(
            feedbackRequest.input,
            feedbackRequest.identifier,
          ),
          status: feedbackRequest.status,
          createdAt: feedbackRequest.createdAt,
          isAccountOwned: true,
        })),
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof UserAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    logger.error('Failed to list feedback requests:', error);
    return internalServerErrorResponse();
  }
}
