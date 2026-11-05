'use server';
import { logger } from '@/lib/logger';
import {
  internalServerErrorResponse,
  unauthorizedResponse,
} from '@/lib/apiResponses';
import {
  updateGraphMobilePhoneForUser,
  updateGraphUserByOid,
} from '@/lib/graph';
import { validateTokenOrNull } from '@/lib/validateToken';
import { normalizeGraphAttorneyPatch } from '@/lib/graphExtension';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const ProfileUpdateSchema = z.preprocess(normalizeGraphAttorneyPatch, z
  .object({
    givenName: z.string().optional(),
    surname: z.string().optional(),
    streetAddress: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
    mobilePhone: z.string().nullable().optional(),
    isAttorney: z
      .boolean()
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0));

async function graphFailureResponse(response: Response | null) {
  if (!response) {
    return NextResponse.json(
      { error: 'Failed to acquire access token' },
      { status: 500 },
    );
  }

  const errorText = await response.text();
  return NextResponse.json(
    { error: 'Failed to update user profile', details: errorText },
    { status: response.status },
  );
}

export async function PATCH(request: Request) {
  logger.info('Received profile update request');
  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) {
    return unauthorizedResponse();
  }

  let payload: Awaited<ReturnType<typeof validateTokenOrNull>>;
  try {
    payload = await validateTokenOrNull(token, 'PATCH /api/accounts/profile');
  } catch (error) {
    logger.error(
      'Token validation infrastructure failure during PATCH /api/accounts/profile:',
      error,
    );
    return internalServerErrorResponse();
  }
  if (!payload) {
    return unauthorizedResponse();
  }

  const tenantId = process.env.NEXT_PUBLIC_AAD_TENANT_ID;
  if (!tenantId) {
    return internalServerErrorResponse();
  }
  const tokenTenantId = payload.tid ?? tenantId;
  if (
    typeof payload.oid !== 'string' ||
    typeof tokenTenantId !== 'string' ||
    tokenTenantId.toLowerCase() !== tenantId.toLowerCase()
  ) {
    return unauthorizedResponse();
  }

  try {
    const oid = payload.oid;

    logger.info('Processing profile update for OID:', oid);

    const parsed = ProfileUpdateSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid profile update' },
        { status: 400 },
      );
    }

    const { mobilePhone, ...otherChanges } = parsed.data;
    if (Object.hasOwn(parsed.data, 'mobilePhone')) {
      const response = await updateGraphMobilePhoneForUser(
        oid,
        token,
        mobilePhone?.trim() || null,
      );
      if (!response?.ok) {
        return graphFailureResponse(response);
      }
    }

    if (Object.keys(otherChanges).length > 0) {
      const response = await updateGraphUserByOid(oid, otherChanges);
      if (!response?.ok) {
        return graphFailureResponse(response);
      }
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    logger.error('Error processing request:', error);
    return internalServerErrorResponse();
  }
}
