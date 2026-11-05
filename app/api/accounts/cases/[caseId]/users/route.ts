import { logger } from '@/lib/logger';
import { ACCOUNT_OPERATIONS_HUB_NAME } from '@/lib/accountOperationsEventHub';
import { sanitizeUserAccount } from '@/lib/accountInfo';
import { getCosmosContainer } from '@/lib/cosmos';
import {
  getSharePointGrantAccessLevel,
  normalizeDocumentAccessRole,
  type DocumentAccessRole,
} from '@/lib/sharePointAccess';
import {
  CaseAccountGroupSchema,
  StoredUserAccountsSchema,
  isCaseAccountVisible,
} from '@/lib/types';
import { validateRequestToken } from '@/lib/validateToken';
import { SqlQuerySpec } from '@azure/cosmos';
import { EventHubProducerClient } from '@azure/event-hubs';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/cases/[caseId]/users'>,
) {
  const { caseId } = await ctx.params;

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

  const stripOtherCases = refinedItems
    .map((item) => ({
      ...item,
      casesAccounts: item.casesAccounts.filter(
        (ca) => ca.accountId === caseId && isCaseAccountVisible(ca),
      ),
    }))
    .filter((item) => item.casesAccounts.length > 0);

  return NextResponse.json(stripOtherCases.map(sanitizeUserAccount));
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/cases/[caseId]/users'>,
) {
  const { caseId } = await ctx.params;
  const hubName = ACCOUNT_OPERATIONS_HUB_NAME;
  const eventHubConnectionString =
    process.env.AZURE_EVENT_HUB_CONNECTION_STRING!;
  let producer: EventHubProducerClient | undefined;

  try {
    const payload = await validateRequestToken(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or missing token' },
        { status: 401 },
      );
    }
    const oid = payload.oid as string;

    let guests: {
      emailAddress: string;
      canUseQA?: boolean;
      canGenerateDeclaration?: boolean;
      canAccessDocuments?: boolean;
      documentAccessRole?: DocumentAccessRole;
    }[];
    try {
      ({ guests } = (await request.json()) as {
        guests: {
          emailAddress: string;
          canUseQA?: boolean;
          canGenerateDeclaration?: boolean;
          canAccessDocuments?: boolean;
          documentAccessRole?: DocumentAccessRole;
        }[];
      });
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const container = getCosmosContainer();
    const querySpec: SqlQuerySpec = {
      query: `SELECT caseAccount from c
JOIN caseAccount in c.casesAccounts
WHERE c.accountId = @accountId AND array_contains(c.oids, @oid) and caseAccount.accountId = @caseId`,
      parameters: [
        { name: '@accountId', value: '00000000-0000-0000-0000-000000000000' },
        { name: '@caseId', value: caseId },
        { name: '@oid', value: oid },
      ],
    };

    const { resources: items } = await container.items
      .query(querySpec)
      .fetchAll();
    const parsedCaseAccounts = CaseAccountGroupSchema.parse(items);
    if (parsedCaseAccounts.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const currentUserCaseAccount = parsedCaseAccounts[0].caseAccount;
    if (!isCaseAccountVisible(currentUserCaseAccount)) {
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

    const firstCaseNumber =
      parsedCaseAccounts.length > 0
        ? currentUserCaseAccount.caseNumber
        : 'Unknown';

    producer = new EventHubProducerClient(eventHubConnectionString, hubName);

    for (const guest of guests) {
      const {
        emailAddress,
        canUseQA = false,
        canGenerateDeclaration = false,
        canAccessDocuments = false,
      } = guest;
      const documentAccessRole = canAccessDocuments
        ? normalizeDocumentAccessRole(guest.documentAccessRole)
        : undefined;
      const accessLevel = getSharePointGrantAccessLevel({
        canAccessDocuments,
        documentAccessRole,
      });
      const request = {
        eventKind: 'CaseAccountUserLink',
        requesterOid: oid,
        recipient: {
          emailAddress: emailAddress,
        },
        caseId,
        caseNumber: firstCaseNumber,
        canUseQA,
        canGenerateDeclaration,
        canAccessDocuments,
        ...(documentAccessRole && accessLevel
          ? { documentAccessRole, accessLevel }
          : {}),
        requestDate: new Date().toISOString(),
      };

      const batch = await producer.createBatch();
      const event = { body: request };

      if (!batch.tryAdd(event)) {
        return NextResponse.json(
          { error: 'Event payload too large to enqueue' },
          { status: 413 },
        );
      }

      await producer.sendBatch(batch);
    }

    return new NextResponse(null, { status: 204 });
  } finally {
    if (producer) {
      try {
        await producer.close();
      } catch (error) {
        logger.error(
          'Failed to close EventHub producer for case user sharing:',
          error,
        );
      }
    }
  }
}
