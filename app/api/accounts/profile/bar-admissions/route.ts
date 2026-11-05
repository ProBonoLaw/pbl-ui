import { logger } from '@/lib/logger';
import {
  internalServerErrorResponse,
  unauthorizedResponse,
} from '@/lib/apiResponses';
import { getCosmosContainer } from '@/lib/cosmos';
import { getIsAttorneyFromGraphByOid } from '@/lib/graph';
import {
  BarAdmissionsResponseSchema,
  type BarAdmission,
} from '@/lib/types';
import { validateTokenOrNull } from '@/lib/validateToken';
import { SqlQuerySpec } from '@azure/cosmos';
import { NextRequest, NextResponse } from 'next/server';

const ROOT_ACCOUNT_ID = '00000000-0000-0000-0000-000000000000';

type RootUserAccountDocument = {
  id: string;
  accountId: string;
  barAdmissions?: BarAdmission[];
  [key: string]: unknown;
};

async function getCurrentUserAccount(oid: string) {
  const container = getCosmosContainer();
  const querySpec: SqlQuerySpec = {
    query:
      'SELECT TOP 1 * FROM c WHERE c.accountId = @accountId AND ARRAY_CONTAINS(c.oids, @oid)',
    parameters: [
      { name: '@accountId', value: ROOT_ACCOUNT_ID },
      { name: '@oid', value: oid },
    ],
  };
  const { resources } = await container.items
    .query<RootUserAccountDocument>(querySpec)
    .fetchAll();

  return { container, account: resources[0] };
}

async function getRequestOid(request: NextRequest, operation: string) {
  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) {
    return null;
  }

  const payload = await validateTokenOrNull(token, operation);
  const oid = payload?.oid;
  return typeof oid === 'string' ? oid : null;
}

async function verifyAttorney(oid: string) {
  if (!(await getIsAttorneyFromGraphByOid(oid))) {
    return NextResponse.json(
      { error: 'Bar admissions are available only to attorney accounts.' },
      { status: 403 },
    );
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const oid = await getRequestOid(
      request,
      'GET /api/accounts/profile/bar-admissions',
    );
    if (!oid) {
      return unauthorizedResponse();
    }

    const attorneyError = await verifyAttorney(oid);
    if (attorneyError) {
      return attorneyError;
    }

    const { account } = await getCurrentUserAccount(oid);
    if (!account) {
      return NextResponse.json(
        { error: 'User account is not initialized.' },
        { status: 403 },
      );
    }

    const parsed = BarAdmissionsResponseSchema.safeParse({
      barAdmissions: account.barAdmissions ?? [],
    });
    if (!parsed.success) {
      logger.error('Invalid bar admissions stored for account:', account.id);
      return internalServerErrorResponse();
    }

    return NextResponse.json(parsed.data);
  } catch (error) {
    logger.error('Failed to load bar admissions:', error);
    return internalServerErrorResponse();
  }
}

export async function PUT(request: NextRequest) {
  try {
    const oid = await getRequestOid(
      request,
      'PUT /api/accounts/profile/bar-admissions',
    );
    if (!oid) {
      return unauthorizedResponse();
    }

    const attorneyError = await verifyAttorney(oid);
    if (attorneyError) {
      return attorneyError;
    }

    const parsedBody = BarAdmissionsResponseSchema.safeParse(
      await request.json(),
    );
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid bar admissions.' },
        { status: 400 },
      );
    }

    const { container, account } = await getCurrentUserAccount(oid);
    if (!account) {
      return NextResponse.json(
        { error: 'User account is not initialized.' },
        { status: 403 },
      );
    }

    if (parsedBody.data.barAdmissions.length === 0) {
      delete account.barAdmissions;
    } else {
      account.barAdmissions = parsedBody.data.barAdmissions;
    }
    await container.items.upsert(account);

    return NextResponse.json(parsedBody.data);
  } catch (error) {
    logger.error('Failed to save bar admissions:', error);
    return internalServerErrorResponse();
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const oid = await getRequestOid(
      request,
      'DELETE /api/accounts/profile/bar-admissions',
    );
    if (!oid) {
      return unauthorizedResponse();
    }

    const { container, account } = await getCurrentUserAccount(oid);
    if (!account) {
      return new NextResponse(null, { status: 204 });
    }

    delete account.barAdmissions;
    await container.items.upsert(account);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error('Failed to remove bar admissions:', error);
    return internalServerErrorResponse();
  }
}
