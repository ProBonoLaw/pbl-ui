import { logger } from '@/lib/logger';
import { ACCOUNT_OPERATIONS_HUB_NAME } from '@/lib/accountOperationsEventHub';
import {
  internalServerErrorResponse,
  unauthorizedResponse,
} from '@/lib/apiResponses';
import { getCosmosContainer } from '@/lib/cosmos';
import { getSharePointGrantAccessLevel } from '@/lib/sharePointAccess';
import { CaseAccountSchema, isCaseAccountVisible } from '@/lib/types';
import { validateTokenOrNull } from '@/lib/validateToken';
import { SqlQuerySpec } from '@azure/cosmos';
import { EventHubProducerClient } from '@azure/event-hubs';
import { NextRequest, NextResponse } from 'next/server';

const ROOT_ACCOUNT_ID = '00000000-0000-0000-0000-000000000000';
const OFFER_DELAY_MS = 3 * 24 * 60 * 60 * 1000;

type MutableCaseAccount = {
  accountId?: unknown;
  caseNumber?: unknown;
  billingCode?: unknown;
  termsBillingCode?: unknown;
  agreedToCaseTerms?: boolean;
  isGuest?: boolean;
  isActive?: boolean;
  expiry?: Date | string | null;
  canGenerateDeclaration?: boolean;
  canUseQA?: boolean;
  canAccessDocuments?: boolean;
  documentAccessRole?: unknown;
  requestDate?: string;
  [key: string]: unknown;
};

type MutableUserAccount = {
  emailAddresses?: unknown;
  oids?: unknown;
  casesAccounts?: MutableCaseAccount[];
  offeredDemo?: {
    acceptedOffer?: boolean;
    nextOffer?: string;
    lastOffer?: string;
  } | null;
  [key: string]: unknown;
};

function getConfiguredDemoAccountIds() {
  return (process.env.DEMO_ACCOUNT_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function shouldOfferDemo(userAccount: MutableUserAccount, now: Date) {
  const visibleCases = (userAccount.casesAccounts ?? []).filter((caseAccount) =>
    isCaseAccountVisible(caseAccount, now),
  );
  if (visibleCases.length > 0) {
    return false;
  }

  const offeredDemo = userAccount.offeredDemo;
  if (!offeredDemo) {
    return true;
  }

  if (offeredDemo.acceptedOffer === true) {
    return false;
  }

  if (!offeredDemo.nextOffer) {
    return true;
  }

  const nextOffer = new Date(offeredDemo.nextOffer);
  if (Number.isNaN(nextOffer.getTime())) {
    return true;
  }

  return nextOffer.getTime() < now.getTime();
}

async function getCurrentUserAccount(oid: string) {
  const container = getCosmosContainer();
  const querySpec: SqlQuerySpec = {
    query:
      'SELECT TOP 1 * from c WHERE c.accountId = @accountId AND array_contains(c.oids, @oid)',
    parameters: [
      { name: '@accountId', value: ROOT_ACCOUNT_ID },
      { name: '@oid', value: oid },
    ],
  };

  const { resources: items } = await container.items
    .query(querySpec)
    .fetchAll();
  const account = items[0] as MutableUserAccount | undefined;
  if (!account) {
    return null;
  }

  if (!Array.isArray(account.casesAccounts)) {
    account.casesAccounts = [];
  }

  return account;
}

async function getDemoCaseAccounts(demoAccountIds: string[]) {
  const container = getCosmosContainer();
  const demoCaseAccounts = [] as ReturnType<typeof CaseAccountSchema.parse>[];

  const results = await Promise.all(
    demoAccountIds.map(async (demoAccountId) => {
      const querySpec: SqlQuerySpec = {
        query: `SELECT TOP 1 caseAccount
FROM c
JOIN caseAccount IN c.casesAccounts
WHERE c.accountId = @accountId
  AND caseAccount.accountId = @caseId
  AND (NOT IS_DEFINED(caseAccount.isGuest) OR caseAccount.isGuest != true)`,
        parameters: [
          { name: '@accountId', value: ROOT_ACCOUNT_ID },
          { name: '@caseId', value: demoAccountId },
        ],
      };

      const { resources: items } = await container.items
        .query(querySpec)
        .fetchAll();
      if (items[0]?.caseAccount) {
        return CaseAccountSchema.parse(items[0].caseAccount);
      }

      logger.warn('Configured demo account was not found:', demoAccountId);
      return null;
    }),
  );

  for (const demoCaseAccount of results) {
    if (demoCaseAccount) {
      demoCaseAccounts.push(demoCaseAccount);
    }
  }

  return demoCaseAccounts;
}

async function sendSharePointGrantEvents(input: {
  demoCaseAccounts: MutableCaseAccount[];
  emailAddress: string;
  oid: string;
}) {
  const eventHubConnectionString =
    process.env.AZURE_EVENT_HUB_CONNECTION_STRING;
  if (!eventHubConnectionString) {
    throw new Error('SharePoint grant event configuration is missing');
  }

  const producer = new EventHubProducerClient(
    eventHubConnectionString,
    ACCOUNT_OPERATIONS_HUB_NAME,
  );
  try {
    let batch = await producer.createBatch();
    for (const caseAccount of input.demoCaseAccounts) {
      if (typeof caseAccount.accountId !== 'string') {
        continue;
      }

      const accessLevel = getSharePointGrantAccessLevel(caseAccount);
      if (!accessLevel) {
        continue;
      }

      const event = {
        body: {
          eventKind: 'SharePointAccessGrant',
          accountId: caseAccount.accountId,
          recipient: {
            emailAddress: input.emailAddress,
            oid: input.oid,
          },
          accessLevel,
        },
      };

      if (!batch.tryAdd(event)) {
        await producer.sendBatch(batch);
        batch = await producer.createBatch();

        if (!batch.tryAdd(event)) {
          return NextResponse.json(
            { error: 'Event payload too large to enqueue' },
            { status: 413 },
          );
        }
      }
    }

    if (batch.count > 0) {
      await producer.sendBatch(batch);
    }
  } finally {
    try {
      await producer.close();
    } catch (error) {
      logger.error('Failed to close demo SharePoint grant producer:', error);
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) {
    return unauthorizedResponse();
  }

  let payload: Awaited<ReturnType<typeof validateTokenOrNull>>;
  try {
    payload = await validateTokenOrNull(token, 'GET /api/accounts/demo-offer');
  } catch (error) {
    logger.error(
      'Token validation infrastructure failure during GET /api/accounts/demo-offer:',
      error,
    );
    return internalServerErrorResponse();
  }
  if (!payload) {
    return unauthorizedResponse();
  }

  try {
    const demoAccountIds = getConfiguredDemoAccountIds();
    const account = await getCurrentUserAccount(payload.oid as string);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    return NextResponse.json({
      shouldOffer:
        demoAccountIds.length > 0 && shouldOfferDemo(account, new Date()),
      demoAccountCount: demoAccountIds.length,
    });
  } catch (error) {
    logger.error('Failed to resolve demo offer state:', error);
    return internalServerErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) {
    return unauthorizedResponse();
  }

  let payload: Awaited<ReturnType<typeof validateTokenOrNull>>;
  try {
    payload = await validateTokenOrNull(token, 'POST /api/accounts/demo-offer');
  } catch (error) {
    logger.error(
      'Token validation infrastructure failure during POST /api/accounts/demo-offer:',
      error,
    );
    return internalServerErrorResponse();
  }
  if (!payload) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as { acceptedOffer?: unknown };
    const acceptedOffer = body.acceptedOffer === true;
    const now = new Date();
    const account = await getCurrentUserAccount(payload.oid as string);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    if (!acceptedOffer) {
      account.offeredDemo = {
        acceptedOffer: false,
        lastOffer: now.toISOString(),
        nextOffer: new Date(now.getTime() + OFFER_DELAY_MS).toISOString(),
      };
      await getCosmosContainer().items.upsert(account);
      return NextResponse.json({ installed: 0 });
    }

    const demoAccountIds = getConfiguredDemoAccountIds();
    if (demoAccountIds.length === 0) {
      return NextResponse.json(
        { error: 'Demo accounts are not configured' },
        { status: 400 },
      );
    }

    const demoCaseAccounts = await getDemoCaseAccounts(demoAccountIds);
    if (demoCaseAccounts.length === 0) {
      return NextResponse.json(
        { error: 'Configured demo accounts were not found' },
        { status: 404 },
      );
    }

    const installedCaseAccounts = demoCaseAccounts.map((caseAccount) => ({
      accountId: caseAccount.accountId,
      caseNumber: caseAccount.caseNumber,
      billingCode: caseAccount.billingCode,
      termsBillingCode: caseAccount.termsBillingCode,
      agreedToCaseTerms: false,
      isGuest: true,
      isActive: true,
      canGenerateDeclaration: true,
      canUseQA: true,
      canAccessDocuments: true,
      documentAccessRole: 'VIEW-ONLY',
      requestDate: now.toISOString(),
    }));

    const casesAccounts = (account.casesAccounts ??= []);

    for (const demoCaseAccount of installedCaseAccounts) {
      const existingCaseAccount = casesAccounts.find(
        (caseAccount) => caseAccount.accountId === demoCaseAccount.accountId,
      );

      if (existingCaseAccount) {
        Object.assign(existingCaseAccount, demoCaseAccount);
      } else {
        casesAccounts.push(demoCaseAccount);
      }
    }

    account.offeredDemo = {
      acceptedOffer: true,
      lastOffer: now.toISOString(),
    };

    const emailAddresses = account.emailAddresses;
    const primaryEmailAddress = Array.isArray(emailAddresses)
      ? emailAddresses.find((emailAddress) => typeof emailAddress === 'string')
      : undefined;
    if (!primaryEmailAddress) {
      return NextResponse.json(
        { error: 'Account does not have an email address' },
        { status: 400 },
      );
    }

    const eventHubConnectionString =
      process.env.AZURE_EVENT_HUB_CONNECTION_STRING;
    if (!eventHubConnectionString) {
      return NextResponse.json(
        { error: 'SharePoint grant event configuration is missing' },
        { status: 500 },
      );
    }

    await getCosmosContainer().items.upsert(account);
    const sharePointResponse = await sendSharePointGrantEvents({
      demoCaseAccounts: installedCaseAccounts,
      emailAddress: primaryEmailAddress,
      oid: payload.oid as string,
    });
    if (sharePointResponse) {
      return sharePointResponse;
    }

    return NextResponse.json({ installed: installedCaseAccounts.length });
  } catch (error) {
    logger.error('Failed to update demo offer state:', error);
    return internalServerErrorResponse();
  }
}
