import { logger } from "@/lib/logger";
import { requireUserAccess, UserAccessError } from '@/lib/userAccess';
import { UnauthorizedError } from '@/lib/types';
import { validateRequestToken } from '@/lib/validateToken';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const payload = await validateRequestToken(request);

    const oid = payload.oid as string | undefined;
    if (!oid) {
      return NextResponse.json({ error: 'Missing oid claim' }, { status: 400 });
    }

    const access = await requireUserAccess(oid);
    return NextResponse.json(access);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: 'Invalid or missing token' },
        { status: 401 },
      );
    }
    if (
      error instanceof UserAccessError &&
      error.code === 'ACCOUNT_NOT_INITIALIZED'
    ) {
      return NextResponse.json({ agreedToTerms: false, isActive: false });
    }
    if (error instanceof UserAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    logger.error('Failed to fetch user access state:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user access state' },
      { status: 500 },
    );
  }
}
