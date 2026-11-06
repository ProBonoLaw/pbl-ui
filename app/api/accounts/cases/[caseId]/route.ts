'use server';
import { logger } from '@/lib/logger';
import { ACCOUNT_OPERATIONS_HUB_NAME } from '@/lib/accountOperationsEventHub';

import {
  AccountInfoValidationError,
  getAccountInfo,
  getTermsBillingCodeForGuestCase,
  getUserAccountInfo,
  updateAccountInfo,
} from '@/lib/accountInfo';
import {
  internalServerErrorResponse,
  unauthorizedResponse,
} from '@/lib/apiResponses';
import { getCosmosContainer } from '@/lib/cosmos';
import { CaseClosure, CaseMapModel } from '@/lib/types';
import { requireUserCaseAccess, UserAccessError } from '@/lib/userAccess';
import { validateTokenOrNull } from '@/lib/validateToken';
import { EventHubProducerClient } from '@azure/event-hubs';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/cases/[caseId]'>,
) {
  const { caseId } = await ctx.params;
  logger.info('GET /api/accounts/cases/[caseId] for caseId:', caseId);
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

  let payload: Awaited<ReturnType<typeof validateTokenOrNull>>;
  try {
    payload = await validateTokenOrNull(
      token,
      'GET /api/accounts/cases/[caseId]',
    );
  } catch (error) {
    logger.error(
      'Token validation infrastructure failure during GET /api/accounts/cases/[caseId]:',
      error,
    );
    return internalServerErrorResponse();
  }
  if (!payload) {
    return unauthorizedResponse();
  }

  try {
    const userId = payload.oid as string;
    await requireUserCaseAccess(userId, caseId, {
      requireIsActive: true,
      allowInactiveGuestAccess: true,
      requireCaseTerms: false,
    });

    const account = await getUserAccountInfo(userId, caseId);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const caseAccount = account.casesAccounts[0];
    if (caseAccount) {
      caseAccount.termsBillingCode = await getTermsBillingCodeForGuestCase(
        caseId,
        caseAccount,
      );
    }

    return NextResponse.json(account);
  } catch (e) {
    if (e instanceof UserAccessError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status },
      );
    }
    logger.error('Error fetching case:', e);
    return internalServerErrorResponse();
  }
}

export async function PUT(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/cases/[caseId]'>,
) {
  const { caseId } = await ctx.params;
  logger.info('PUT /api/accounts/cases/[caseId] for caseId:', caseId);
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

  let payload: Awaited<ReturnType<typeof validateTokenOrNull>>;
  try {
    payload = await validateTokenOrNull(
      token,
      'PUT /api/accounts/cases/[caseId]',
    );
  } catch (error) {
    logger.error(
      'Token validation infrastructure failure during PUT /api/accounts/cases/[caseId]:',
      error,
    );
    return internalServerErrorResponse();
  }
  if (!payload) {
    return unauthorizedResponse();
  }

  try {
    const userId = payload.oid as string;
    await requireUserCaseAccess(userId, caseId, { requireIsActive: true });

    const body = await request.json();
    const account = await getAccountInfo(caseId);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const caseMap = CaseMapModel.parse(body);
    if (!caseMap.record) {
      return NextResponse.json({ error: 'Invalid case data' }, { status: 400 });
    }

    const updatedAccount = await updateAccountInfo(
      userId,
      caseId,
      caseMap.record,
    );

    const userAccount = await getUserAccountInfo(userId, caseId, false, false);
    const caseAccount = userAccount?.casesAccounts.find(
      (ca) => ca.accountId === caseId,
    );
    if (!caseAccount) {
      return NextResponse.json(
        { error: 'Account not found for user' },
        { status: 404 },
      );
    }

    if (caseMap.record.caseNumber !== caseAccount.caseNumber) {
      logger.info(
        `Case number changed from ${caseAccount.caseNumber} to ${caseMap.record.caseNumber}`,
      );
      caseAccount.caseNumber = caseMap.record.caseNumber;
      const container = getCosmosContainer();
      container.items.upsert(userAccount);
    }

    return NextResponse.json(updatedAccount);
  } catch (e) {
    if (e instanceof AccountInfoValidationError) {
      logger.warn('Invalid merged case data during update:', e.issues);
      return NextResponse.json(
        {
          error: e.message,
          details: e.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }
    if (e instanceof UserAccessError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status },
      );
    }
    logger.error('Error updating case:', e);
    return internalServerErrorResponse();
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/cases/[caseId]'>,
) {
  const { caseId } = await ctx.params;
  logger.info('DELETE /api/accounts/cases/[caseId] for caseId:', caseId);
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

  let payload: Awaited<ReturnType<typeof validateTokenOrNull>>;
  try {
    payload = await validateTokenOrNull(
      token,
      'DELETE /api/accounts/cases/[caseId]',
    );
  } catch (error) {
    logger.error(
      'Token validation infrastructure failure during DELETE /api/accounts/cases/[caseId]:',
      error,
    );
    return internalServerErrorResponse();
  }
  if (!payload) {
    return unauthorizedResponse();
  }

  try {
    const userId = payload.oid as string;
    await requireUserCaseAccess(userId, caseId, { requireIsActive: true });

    const account = await getUserAccountInfo(userId, caseId);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    if (account.casesAccounts.length === 0) {
      return NextResponse.json(
        { error: `The user is not associated with case ${caseId}` },
        { status: 403 },
      );
    }

    if (account.casesAccounts[0].isGuest) {
      return NextResponse.json(
        { error: 'Guest users cannot delete accounts' },
        { status: 403 },
      );
    }

    const hubName = ACCOUNT_OPERATIONS_HUB_NAME;
    const eventHubConnectionString =
      process.env.AZURE_EVENT_HUB_CONNECTION_STRING!;
    const producer = new EventHubProducerClient(
      eventHubConnectionString,
      hubName,
    );

    try {
      const batch = await producer.createBatch();
      const eventData: CaseClosure = {
        eventKind: 'AccountCleanup',
        accountId: caseId,
        deactivate: {
          emailIngestion: true,
          dataIngestion: true,
          sharePoint: true,
          account: true,
        },
      };
      const event = { body: eventData };
      if (!batch.tryAdd(event)) {
        return NextResponse.json(
          { error: 'Event payload too large to enqueue' },
          { status: 413 },
        );
      }
      await producer.sendBatch(batch);
    } finally {
      try {
        await producer.close();
      } catch (error) {
        logger.error(
          'Failed to close EventHub producer for case deletion:',
          error,
        );
      }
    }

    logger.info(
      `Deleting account with caseId: ${caseId} for userId: ${userId}`,
    );
    return NextResponse.json({
      message: `Account with caseId: ${caseId} deleted successfully`,
    });
  } catch (e) {
    if (e instanceof UserAccessError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status },
      );
    }
    logger.error('Error deleting case:', e);
    return internalServerErrorResponse();
  }
}
