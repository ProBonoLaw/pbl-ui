'use server';
import { logger } from '@/lib/logger';
import { ACCOUNT_OPERATIONS_HUB_NAME } from '@/lib/accountOperationsEventHub';

import { getAccountInfo, sanitizeUserAccounts } from '@/lib/accountInfo';
import {
  internalServerErrorResponse,
  unauthorizedResponse,
} from '@/lib/apiResponses';
import { getCaseCreationFeatures } from '@/lib/caseCreationFeatures';
import { getCosmosContainer } from '@/lib/cosmos';
import { getIsAttorneyFromGraphByOid } from '@/lib/graph';
import {
  StoredUserAccountsSchema,
  parseOriginalCaseRecordRequest,
} from '@/lib/types';
import { requireUserAccess, UserAccessError } from '@/lib/userAccess';
import { validateTokenOrNull } from '@/lib/validateToken';
import { SqlQuerySpec } from '@azure/cosmos';
import { EventHubProducerClient } from '@azure/event-hubs';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) {
    return unauthorizedResponse();
  }

  let payload: Awaited<ReturnType<typeof validateTokenOrNull>>;
  try {
    payload = await validateTokenOrNull(token, 'GET /api/accounts/cases');
  } catch (error) {
    logger.error(
      'Token validation infrastructure failure during GET /api/accounts/cases:',
      error,
    );
    return internalServerErrorResponse();
  }
  if (!payload) {
    return unauthorizedResponse();
  }

  try {
    const oid = payload.oid as string;
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

    await Promise.all(
      items.map(async (entry) => {
        const casesAccounts = entry.casesAccounts;
        if (
          !casesAccounts ||
          !Array.isArray(casesAccounts) ||
          casesAccounts.length === 0
        ) {
          logger.info('No casesAccounts found for entry:', entry);
          return;
        }

        await Promise.all(
          casesAccounts.map(async (item) => {
            const detailItems = (await getAccountInfo(item.accountId))?.data;
            item.record = detailItems;
          }),
        );
      }),
    );

    const resultingItems = sanitizeUserAccounts(
      StoredUserAccountsSchema.parse(items),
    );
    return NextResponse.json(resultingItems);
  } catch (e) {
    logger.error('Error loading cases:', e);
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
    payload = await validateTokenOrNull(token, 'POST /api/accounts/cases');
  } catch (error) {
    logger.error(
      'Token validation infrastructure failure during POST /api/accounts/cases:',
      error,
    );
    return internalServerErrorResponse();
  }
  if (!payload) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const caseInfo = parseOriginalCaseRecordRequest(body);
    const oppositionAttorney =
      caseInfo.opposition?.currentAttorney ||
      caseInfo.opposition?.attorneyInformation?.[0];
    logger.info('Received new case data:', body);

    const oid = payload.oid as string;
    await requireUserAccess(oid, {
      requireAgreedToTerms: true,
      requireIsActive: true,
    });
    const shouldResolveCallerIsAttorney =
      caseInfo.billingCode === 'F' || caseInfo.isAttorney === true;
    const callerIsAttorney = shouldResolveCallerIsAttorney
      ? await getIsAttorneyFromGraphByOid(oid)
      : false;
    if (caseInfo.billingCode === 'F' && !callerIsAttorney) {
      throw new UserAccessError(
        'Pro bono billing code is restricted to attorney accounts.',
        403,
        'BILLING_CODE_FORBIDDEN',
      );
    }
    const caseCreationFeatures = getCaseCreationFeatures(
      caseInfo.billingCode,
      callerIsAttorney,
    );

    const producerClient = new EventHubProducerClient(
      process.env.AZURE_EVENT_HUB_ACCOUNT_MANAGEMENT_CONNECTION_STRING!,
      ACCOUNT_OPERATIONS_HUB_NAME,
    );

    try {
      await producerClient.sendBatch([
      {
        body: {
          eventKind: 'AccountInitialization',
          attorney: {
            id: callerIsAttorney ? oid : undefined,
            firstName: caseInfo.currentAttorney?.firstName,
            lastName: caseInfo.currentAttorney?.lastName,
            emailAddress: caseInfo.currentAttorney?.emailAddress,
            phoneNumber: caseInfo.currentAttorney?.phoneNumber,
            firmName: caseInfo.currentAttorney?.firmName,
          },
          client: {
            id: !callerIsAttorney ? oid : undefined,
            firstName: caseInfo.personInformation?.firstName,
            lastName: caseInfo.personInformation?.lastName,
            organization: caseInfo.personInformation?.organization,
            emailAddress: caseInfo.personInformation?.emailAddress,
            phoneNumber: caseInfo.personInformation?.phoneNumber,
          },
          case: {
            caseId: caseInfo.caseNumber,
            description: caseInfo.description,
            filingRole: caseInfo.filingRole,
            state: caseInfo.state,
            county: caseInfo.county,
          },
          billingCode: caseInfo.billingCode,
          opposition: {
            client: {
              firstName: caseInfo.opposition?.firstName,
              lastName: caseInfo.opposition?.lastName,
              organization: caseInfo.opposition?.organization,
              emailAddress: caseInfo.opposition?.emailAddress,
              phoneNumber: caseInfo.opposition?.phoneNumber,
            },
            attorney: {
              firstName: oppositionAttorney?.firstName,
              lastName: oppositionAttorney?.lastName,
              emailAddress: oppositionAttorney?.emailAddress,
              phoneNumber: oppositionAttorney?.phoneNumber,
              firmName: oppositionAttorney?.firmName,
            },
          },
          ...caseCreationFeatures,
        },
      },
      ]);
    } finally {
      try {
        await producerClient.close();
      } catch (error) {
        logger.error('Failed to close EventHub producer for case creation:', error);
      }
    }

    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof UserAccessError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status },
      );
    }

    logger.error('Error creating case:', e);
    return internalServerErrorResponse();
  }
}
