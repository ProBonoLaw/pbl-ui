'use server';
import { logger } from '@/lib/logger';
import {
  internalServerErrorResponse,
  unauthorizedResponse,
} from '@/lib/apiResponses';
import { uploadGraphUserPhotoByOid } from '@/lib/graph';
import { validateTokenOrNull } from '@/lib/validateToken';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  logger.info('Received profile photo update request');
  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) {
    return unauthorizedResponse();
  }

  let payload: Awaited<ReturnType<typeof validateTokenOrNull>>;
  try {
    payload = await validateTokenOrNull(token, 'POST /api/accounts/profile/photo');
  } catch (error) {
    logger.error(
      'Token validation infrastructure failure during POST /api/accounts/profile/photo:',
      error,
    );
    return internalServerErrorResponse();
  }
  if (!payload) {
    return unauthorizedResponse();
  }

  try {
    const oid = payload.oid as string;

    logger.info('Processing profile update for OID:', oid);

    const requestBody = await request.formData();
    if (!requestBody.get('photo')) {
      return NextResponse.json({ error: 'No photo provided' }, { status: 400 });
    }

    const response = await uploadGraphUserPhotoByOid(
      oid,
      requestBody.get('photo')!,
    );
    if (!response) {
      return NextResponse.json(
        { error: 'Failed to acquire access token for profile photo update' },
        { status: 500 },
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Failed to update user profile photo', details: errorText },
        { status: response.status },
      );
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    logger.error('Error processing request:', error);
    return internalServerErrorResponse();
  }
}
