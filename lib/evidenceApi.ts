import { NextResponse } from 'next/server';

import {
  internalServerErrorResponse,
  unauthorizedResponse,
} from '@/lib/apiResponses';
import { logger } from '@/lib/logger';
import { UnauthorizedError } from '@/lib/types';
import { requireUserCaseAccess, UserAccessError } from '@/lib/userAccess';
import { validateTokenOrNull } from '@/lib/validateToken';

export async function authorizeEvidenceRequest(
  request: Request,
  caseId: string,
  routeName: string,
) {
  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) {
    throw new UnauthorizedError('Missing token');
  }

  const jwtPayload = await validateTokenOrNull(token, routeName);
  if (!jwtPayload) {
    throw new UnauthorizedError('Invalid token');
  }

  const oid = jwtPayload.oid as string | undefined;
  if (!oid) {
    throw new UnauthorizedError('Missing oid claim');
  }

  await requireUserCaseAccess(oid, caseId, {
    requireIsActive: true,
    allowInactiveGuestAccess: true,
    requiredFeature: 'canAccessDocuments',
  });
}

export function handleEvidenceRouteError(error: unknown, routeName: string) {
  if (error instanceof UserAccessError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  if (error instanceof UnauthorizedError) {
    return unauthorizedResponse('Invalid or missing token');
  }

  logger.error(`Error processing ${routeName}:`, error);
  return internalServerErrorResponse();
}

export function getEvidenceSearchUrl() {
  return process.env.AIMIE_EVIDENCE_SEARCH_URL?.trim();
}

export function getEvidenceFunctionKeyHeaders(): Record<string, string> {
  const functionKey = process.env.AIMIE_EVIDENCE_FUNCTION_KEY?.trim();
  return functionKey ? { 'x-functions-key': functionKey } : {};
}

export function mapEvidenceServiceStatus(status: number) {
  return status === 400 || status === 404 ? status : 502;
}
