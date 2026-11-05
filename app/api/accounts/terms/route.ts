import { logger } from '@/lib/logger';
import { getCosmosContainer } from '@/lib/cosmos';
import {
  TERMS_OF_SERVICE_SCOPES,
  TERMS_OF_SERVICE_TYPES,
} from '@/lib/termsOfService';
import {
  getTermsOfServiceDocument,
  TermsOfServiceDocumentNotFoundError,
} from '@/lib/termsOfServiceDocuments';
import {
  getClickwrapDocuments,
  getLegalDocument,
} from '@/lib/legalDocuments';
import { UnauthorizedError } from '@/lib/types';
import { validateRequestToken } from '@/lib/validateToken';
import { SqlQuerySpec } from '@azure/cosmos';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ROOT_ACCOUNT_ID = '00000000-0000-0000-0000-000000000000';

const TermsTypeSchema = z.enum(TERMS_OF_SERVICE_TYPES);
const TermsDocumentRequestSchema = z.object({
  scope: z.enum(TERMS_OF_SERVICE_SCOPES),
  termsType: TermsTypeSchema,
  userType: z.enum(['attorney', 'end-client']).default('attorney'),
});
const TermsAcceptanceRequestSchema = z.discriminatedUnion('scope', [
  z.object({
    scope: z.literal(TERMS_OF_SERVICE_SCOPES[0]),
    termsType: TermsTypeSchema,
    userType: z.enum(['attorney', 'end-client']).default('attorney'),
    affirmativeAcceptance: z.literal(true),
  }),
  z.object({
    scope: z.literal(TERMS_OF_SERVICE_SCOPES[1]),
    termsType: TermsTypeSchema,
    caseId: z.uuid(),
  }),
]);

type RootAccountDocument = {
  id?: string;
  accountId?: string;
  emailAddresses?: string[];
  oids?: string[];
  isActive?: boolean;
  agreedToTerms?: boolean;
  casesAccounts?: Array<{
    accountId?: string;
    agreedToCaseTerms?: boolean;
  }>;
  acceptanceRecords?: unknown[];
};

const ATTORNEY_ASSENT = 'By clicking I Accept, you agree to the Pro Bono Law Terms of Service, and you acknowledge the Privacy Policy. The Terms of Service incorporate the Business Associate Agreement, the Data Processing Addendum, and the Acceptable Use Policy. You confirm you are at least 18 years of age and, if you are accepting for an organization, that you are authorized to bind that organization.';
const END_CLIENT_ASSENT = 'By clicking I Accept, you agree to the Pro Bono Law End-Client Terms. You confirm that you are at least 18 years of age.';

function requestIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? null;
}

export async function GET(request: NextRequest) {
  try {
    await validateRequestToken(request);
    const parsedQuery = TermsDocumentRequestSchema.safeParse({
      scope: request.nextUrl.searchParams.get('scope'),
      termsType: request.nextUrl.searchParams.get('termsType'),
      userType: request.nextUrl.searchParams.get('userType') ?? undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: 'Invalid terms document request' },
        { status: 400 },
      );
    }

    if (
      parsedQuery.data.scope === 'user-account' &&
      parsedQuery.data.userType === 'end-client'
    ) {
      const document = await getLegalDocument('end-client-terms');
      return NextResponse.json({
        title: document.title,
        effectiveDate: document.lastModified,
        markdown: document.markdown,
        acknowledgement: END_CLIENT_ASSENT,
      });
    }

    const document = await getTermsOfServiceDocument(parsedQuery.data);
    return NextResponse.json(document);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: 'Invalid or missing token' },
        { status: 401 },
      );
    }

    if (error instanceof TermsOfServiceDocumentNotFoundError) {
      return NextResponse.json(
        { error: 'Terms agreement not found' },
        { status: 404 },
      );
    }

    logger.error('Failed to load terms agreement:', error);
    return NextResponse.json(
      { error: 'Failed to load terms agreement' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await validateRequestToken(request);
    const oid = payload.oid as string | undefined;
    if (!oid) {
      return NextResponse.json({ error: 'Missing oid claim' }, { status: 400 });
    }

    const parsedBody = TermsAcceptanceRequestSchema.safeParse(
      await request.json(),
    );
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid terms acceptance request' },
        { status: 400 },
      );
    }

    const termsRequest = parsedBody.data;
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
      .query<RootAccountDocument>(querySpec)
      .fetchAll();
    let account = items[0];
    if (!account) {
      if (termsRequest.scope !== 'user-account') {
        return NextResponse.json(
          { error: 'User account is not initialized.' },
          { status: 403 },
        );
      }

      const emailAddresses = [payload.preferred_username, payload.upn, payload.email]
        .filter((value): value is string => typeof value === 'string');
      account = {
        id: oid,
        accountId: ROOT_ACCOUNT_ID,
        emailAddresses: [...new Set(emailAddresses)],
        oids: [oid],
        casesAccounts: [],
        agreedToTerms: false,
        isActive: false,
      };
    }

    if (termsRequest.scope === 'user-account') {
      const acceptedDocuments = await getClickwrapDocuments(termsRequest.userType);
      account.agreedToTerms = true;
      account.acceptanceRecords = [
        ...(account.acceptanceRecords ?? []),
        {
          recordType: 'clickwrap',
          user: {
            accountId: oid,
            name: typeof payload.name === 'string' ? payload.name : null,
            email: typeof payload.preferred_username === 'string' ? payload.preferred_username : typeof payload.email === 'string' ? payload.email : null,
          },
          userType: termsRequest.userType,
          documents: acceptedDocuments.map((document) => ({ id: document.id, title: document.title, href: document.href, version: document.version, lastModified: document.lastModified, contentHash: document.contentHash })),
          acceptedAt: new Date().toISOString(),
          ipAddress: requestIp(request),
          userAgent: request.headers.get('user-agent'),
          mechanism: 'checked-checkbox and I Accept button',
          assentText: termsRequest.userType === 'attorney' ? ATTORNEY_ASSENT : END_CLIENT_ASSENT,
        },
      ];
    } else {
      const caseId = termsRequest.caseId;
      const caseAccount = account.casesAccounts?.find(
        (entry) => entry.accountId === caseId,
      );
      if (!caseAccount) {
        return NextResponse.json(
          { error: 'You do not have access to this case.' },
          { status: 403 },
        );
      }

      caseAccount.agreedToCaseTerms = true;
    }

    await container.items.upsert(account);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: 'Invalid or missing token' },
        { status: 401 },
      );
    }

    logger.error('Failed to save terms acceptance:', error);
    return NextResponse.json(
      { error: 'Failed to save terms acceptance' },
      { status: 500 },
    );
  }
}
