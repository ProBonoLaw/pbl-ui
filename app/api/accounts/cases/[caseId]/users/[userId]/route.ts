import { logger } from '@/lib/logger';
import { ACCOUNT_OPERATIONS_HUB_NAME } from '@/lib/accountOperationsEventHub';
import { sanitizeUserAccount } from '@/lib/accountInfo';
import { getCosmosContainer } from '@/lib/cosmos';
import {
  getSharePointAccessEventAction,
  getSharePointGrantAccessLevel,
  normalizeDocumentAccessRole,
  type DocumentAccessRole,
} from '@/lib/sharePointAccess';
import {
  CaseAccountSchema,
  StoredUserAccountsSchema,
  isCaseAccountVisible,
} from '@/lib/types';
import { validateRequestToken } from '@/lib/validateToken';
import { SqlQuerySpec } from '@azure/cosmos';
import { EventHubProducerClient } from '@azure/event-hubs';
import { NextRequest, NextResponse } from 'next/server';

async function sendSharePointAccessEvent(
  eventHubConnectionString: string,
  body: {
    eventKind: 'SharePointAccessGrant' | 'SharePointAccessRevoke';
    accountId: string;
    recipient: {
      emailAddress: string;
      oid?: string;
    };
    accessLevel?: DocumentAccessRole;
  },
) {
  const producer = new EventHubProducerClient(
    eventHubConnectionString,
    ACCOUNT_OPERATIONS_HUB_NAME,
  );

  try {
    const batch = await producer.createBatch();
    const event = { body };

    if (!batch.tryAdd(event)) {
      return NextResponse.json(
        { error: 'Event payload too large to enqueue' },
        { status: 413 },
      );
    }

    await producer.sendBatch(batch);
    return null;
  } finally {
    try {
      await producer.close();
    } catch (error) {
      logger.error(
        'Failed to close SharePoint access EventHub producer:',
        error,
      );
    }
  }
}

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/cases/[caseId]/users/[userId]'>,
) {
  const { caseId, userId } = await ctx.params;

  const payload = await validateRequestToken(request);
  if (!payload) {
    return NextResponse.json(
      { error: 'Invalid or missing token' },
      { status: 401 },
    );
  }
  const oid = payload.oid as string;

  const container = getCosmosContainer();
  const querySpec: SqlQuerySpec = {
    query:
      'SELECT * from c WHERE c.accountId = @accountId AND EXISTS(SELECT VALUE ca FROM ca IN c.casesAccounts WHERE ca.accountId = @caseId)',
    parameters: [
      { name: '@accountId', value: '00000000-0000-0000-0000-000000000000' },
      { name: '@caseId', value: caseId },
    ],
  };

  const { resources: items } = await container.items
    .query(querySpec)
    .fetchAll();
  if (items.length === 0) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  }

  const refinedItems = StoredUserAccountsSchema.parse(items);

  const currentUserAccount = refinedItems.find((item) =>
    item.oids.includes(oid),
  );
  if (!currentUserAccount) {
    logger.info(
      `OID ${oid} does not have access to case ${caseId}: `,
      refinedItems,
    );
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const currentUserCaseAccount = currentUserAccount.casesAccounts.find(
    (ca) => ca.accountId === caseId && isCaseAccountVisible(ca),
  );
  if (
    !currentUserCaseAccount ||
    !isCaseAccountVisible(currentUserCaseAccount)
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (currentUserCaseAccount.agreedToCaseTerms !== true) {
    return NextResponse.json(
      {
        error:
          'You must accept the case terms of service before accessing this case.',
        code: 'CASE_TERMS_NOT_ACCEPTED',
      },
      { status: 403 },
    );
  }

  if (currentUserCaseAccount.isGuest === true) {
    return NextResponse.json(
      { error: 'Guests cannot access case sharing.' },
      { status: 403 },
    );
  }

  const userAccountSpec: SqlQuerySpec = {
    query:
      'SELECT * from c WHERE c.accountId = @accountId AND EXISTS(SELECT VALUE ca FROM ca IN c.casesAccounts WHERE ca.accountId = @caseId) AND array_contains(c.oids, @userId)',
    parameters: [
      { name: '@accountId', value: '00000000-0000-0000-0000-000000000000' },
      { name: '@caseId', value: caseId },
      { name: '@userId', value: userId },
    ],
  };

  const { resources: userItems } = await container.items
    .query(userAccountSpec)
    .fetchAll();
  if (userItems.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const refinedUserItems = StoredUserAccountsSchema.parse(userItems);

  const stripOtherCases = refinedUserItems
    .map((item) => ({
      ...item,
      casesAccounts: item.casesAccounts.filter(
        (ca) => ca.accountId === caseId && isCaseAccountVisible(ca),
      ),
    }))
    .find((item) => item.casesAccounts.length > 0);

  if (!stripOtherCases) {
    return NextResponse.json(
      { error: 'User Account not found' },
      { status: 404 },
    );
  }

  return NextResponse.json(sanitizeUserAccount(stripOtherCases));
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/cases/[caseId]/users/[userId]'>,
) {
  const { caseId, userId } = await ctx.params;
  const eventHubConnectionString =
    process.env.AZURE_EVENT_HUB_CONNECTION_STRING!;

  const payload = await validateRequestToken(request);
  if (!payload) {
    return NextResponse.json(
      { error: 'Invalid or missing token' },
      { status: 401 },
    );
  }
  const oid = payload.oid as string;

  let canUseQA: boolean | undefined;
  let canGenerateDeclaration: boolean | undefined;
  let canAccessDocuments: boolean | undefined;
  let documentAccessRole: DocumentAccessRole | undefined;
  try {
    ({
      canUseQA,
      canGenerateDeclaration,
      canAccessDocuments,
      documentAccessRole,
    } = (await request.json()) as {
      canUseQA?: boolean;
      canGenerateDeclaration?: boolean;
      canAccessDocuments?: boolean;
      documentAccessRole?: DocumentAccessRole;
    });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const container = getCosmosContainer();
  const querySpec: SqlQuerySpec = {
    query:
      'SELECT * from c WHERE c.accountId = @accountId AND EXISTS(SELECT VALUE ca FROM ca IN c.casesAccounts WHERE ca.accountId = @caseId)',
    parameters: [
      { name: '@accountId', value: '00000000-0000-0000-0000-000000000000' },
      { name: '@caseId', value: caseId },
    ],
  };

  const { resources: items } = await container.items
    .query(querySpec)
    .fetchAll();
  if (items.length === 0) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  }

  const refinedItems = StoredUserAccountsSchema.parse(items);

  const currentUserAccount = refinedItems.find((item) =>
    item.oids.includes(oid),
  );
  if (!currentUserAccount) {
    logger.info(
      `OID ${oid} does not have access to case ${caseId}: `,
      refinedItems,
    );
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const currentUserCaseAccount = currentUserAccount.casesAccounts.find(
    (ca) => ca.accountId === caseId,
  );
  if (
    !currentUserCaseAccount ||
    !isCaseAccountVisible(currentUserCaseAccount)
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (currentUserCaseAccount.agreedToCaseTerms !== true) {
    return NextResponse.json(
      {
        error:
          'You must accept the case terms of service before accessing this case.',
        code: 'CASE_TERMS_NOT_ACCEPTED',
      },
      { status: 403 },
    );
  }

  if (currentUserCaseAccount.isGuest === true) {
    return NextResponse.json(
      { error: 'Guests cannot access case sharing.' },
      { status: 403 },
    );
  }

  const userAccountSpec: SqlQuerySpec = {
    query:
      'SELECT * from c WHERE c.accountId = @accountId AND EXISTS(SELECT VALUE ca FROM ca IN c.casesAccounts WHERE ca.accountId = @caseId) AND array_contains(c.oids, @userId)',
    parameters: [
      { name: '@accountId', value: '00000000-0000-0000-0000-000000000000' },
      { name: '@caseId', value: caseId },
      { name: '@userId', value: userId },
    ],
  };

  const { resources: userItems } = await container.items
    .query(userAccountSpec)
    .fetchAll();
  if (userItems.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const refinedUserItems = StoredUserAccountsSchema.parse(userItems);

  const matchedUser = refinedUserItems[0];
  const primaryEmailAddress = matchedUser?.emailAddresses[0];
  if (!matchedUser || !primaryEmailAddress) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  const matchingCaseAccount = matchedUser.casesAccounts.find(
    (ca) => ca.accountId === caseId,
  );
  if (!matchingCaseAccount) {
    return NextResponse.json(
      { error: 'Case account not found' },
      { status: 404 },
    );
  }

  if (matchingCaseAccount.isGuest !== true) {
    return NextResponse.json(
      {
        error:
          'Owners have full control and cannot have sharing access edited.',
      },
      { status: 403 },
    );
  }

  const previousCanAccessDocuments =
    matchingCaseAccount.canAccessDocuments === true;
  const sharePointAccessEventAction = getSharePointAccessEventAction({
    previousCanAccessDocuments,
    nextCanAccessDocuments: canAccessDocuments,
  });

  matchingCaseAccount.canUseQA = canUseQA;
  matchingCaseAccount.canGenerateDeclaration = canGenerateDeclaration;
  matchingCaseAccount.canAccessDocuments = canAccessDocuments;
  matchingCaseAccount.documentAccessRole =
    canAccessDocuments === true
      ? normalizeDocumentAccessRole(documentAccessRole)
      : undefined;

  try {
    await container.items.upsert(matchedUser);
  } catch (error) {
    logger.error('Failed to persist updated case sharing permissions:', error);
    return NextResponse.json(
      { error: 'Failed to update case sharing permissions' },
      { status: 500 },
    );
  }

  if (sharePointAccessEventAction === 'grant') {
    const accessLevel = getSharePointGrantAccessLevel({
      canAccessDocuments,
      documentAccessRole: matchingCaseAccount.documentAccessRole,
    });

    if (accessLevel) {
      const response = await sendSharePointAccessEvent(
        eventHubConnectionString,
        {
          eventKind: 'SharePointAccessGrant',
          accountId: caseId,
          recipient: {
            emailAddress: primaryEmailAddress,
            oid: userId,
          },
          accessLevel,
        },
      );

      if (response) {
        return response;
      }
    }
  }

  if (sharePointAccessEventAction === 'revoke') {
    const response = await sendSharePointAccessEvent(
      eventHubConnectionString,
      {
        eventKind: 'SharePointAccessRevoke',
        accountId: caseId,
        recipient: {
          emailAddress: primaryEmailAddress,
        },
      },
    );

    if (response) {
      return response;
    }
  }

  return new NextResponse(null, { status: 204 });
}

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/cases/[caseId]/users/[userId]'>,
) {
  const { caseId, userId } = await ctx.params;

  const payload = await validateRequestToken(request);
  if (!payload) {
    return NextResponse.json(
      { error: 'Invalid or missing token' },
      { status: 401 },
    );
  }
  const oid = payload.oid as string;
  const targetUserId = userId === 'me' ? oid : userId;

  const container = getCosmosContainer();
  const currentUserCaseAccountSpec: SqlQuerySpec = {
    query: `SELECT TOP 1 caseAccount
FROM c
JOIN caseAccount IN c.casesAccounts
WHERE c.accountId = @accountId
  AND array_contains(c.oids, @oid)
  AND caseAccount.accountId = @caseId`,
    parameters: [
      { name: '@accountId', value: '00000000-0000-0000-0000-000000000000' },
      { name: '@oid', value: oid },
      { name: '@caseId', value: caseId },
    ],
  };

  const { resources: currentUserCaseAccountItems } = await container.items
    .query(currentUserCaseAccountSpec)
    .fetchAll();
  if (currentUserCaseAccountItems.length === 0) {
    logger.info(`OID ${oid} does not have access to case ${caseId}`);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const currentUserCaseAccount = CaseAccountSchema.parse(
    currentUserCaseAccountItems[0].caseAccount,
  );
  if (!isCaseAccountVisible(currentUserCaseAccount)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const isSelfUnshare =
    userId === 'me' && currentUserCaseAccount.isGuest === true;
  if (userId === 'me' && !isSelfUnshare) {
    return NextResponse.json(
      { error: 'Only guest users can unshare themselves.' },
      { status: 403 },
    );
  }

  if (!isSelfUnshare && currentUserCaseAccount.agreedToCaseTerms !== true) {
    return NextResponse.json(
      {
        error:
          'You must accept the case terms of service before accessing this case.',
        code: 'CASE_TERMS_NOT_ACCEPTED',
      },
      { status: 403 },
    );
  }

  if (currentUserCaseAccount.isGuest === true && !isSelfUnshare) {
    return NextResponse.json(
      { error: 'Guests cannot access case sharing.' },
      { status: 403 },
    );
  }

  const userAccountSpec: SqlQuerySpec = {
    query:
      'SELECT * from c WHERE c.accountId = @accountId AND EXISTS(SELECT VALUE ca FROM ca IN c.casesAccounts WHERE ca.accountId = @caseId) AND array_contains(c.oids, @userId)',
    parameters: [
      { name: '@accountId', value: '00000000-0000-0000-0000-000000000000' },
      { name: '@caseId', value: caseId },
      { name: '@userId', value: targetUserId },
    ],
  };

  const { resources: userItems } = await container.items
    .query(userAccountSpec)
    .fetchAll();
  if (userItems.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const matchedUser = userItems[0] as
    | {
        emailAddresses?: unknown;
        casesAccounts?: Array<{
          accountId?: unknown;
          isGuest?: unknown;
          isActive?: boolean;
          [key: string]: unknown;
        }>;
        [key: string]: unknown;
      }
    | undefined;
  if (
    !matchedUser ||
    !Array.isArray(matchedUser.emailAddresses) ||
    typeof matchedUser.emailAddresses[0] !== 'string' ||
    !Array.isArray(matchedUser.casesAccounts)
  ) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const primaryEmailAddress = matchedUser.emailAddresses[0];
  const matchingCaseAccountIndex = matchedUser.casesAccounts
    .map((ca) => ca.accountId)
    .indexOf(caseId);
  if (matchingCaseAccountIndex === -1) {
    return NextResponse.json(
      { error: 'Case account not found' },
      { status: 404 },
    );
  }

  const matchingCaseAccount =
    matchedUser.casesAccounts[matchingCaseAccountIndex];
  const eventHubConnectionString =
    process.env.AZURE_EVENT_HUB_CONNECTION_STRING;

  if (!eventHubConnectionString) {
    return NextResponse.json(
      { error: 'SharePoint access event configuration is missing' },
      { status: 500 },
    );
  }

  if (matchingCaseAccount.isGuest === true) {
    matchingCaseAccount.isActive = false;
  } else {
    matchedUser.casesAccounts.splice(matchingCaseAccountIndex, 1);
  }

  await container.items.upsert(matchedUser);
  const response = await sendSharePointAccessEvent(
    eventHubConnectionString,
    {
      eventKind: 'SharePointAccessRevoke',
      accountId: caseId,
      recipient: {
        emailAddress: primaryEmailAddress,
      },
    },
  );

  if (response) {
    return response;
  }

  return new NextResponse(null, { status: 204 });
}
