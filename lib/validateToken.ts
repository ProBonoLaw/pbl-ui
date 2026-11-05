import { createRemoteJWKSet, JWTPayload, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';
import { logger } from './logger';
import { UnauthorizedError } from './types';

const JWT_AUTH_ERROR_NAMES = new Set([
  'JOSEAlgNotAllowed',
  'JWSInvalid',
  'JWSSignatureVerificationFailed',
  'JWTClaimValidationFailed',
  'JWTExpired',
  'JWTInvalid',
  'JWKSNoMatchingKey',
]);

const JWT_AUTH_ERROR_CODES = new Set([
  'ERR_JOSE_ALG_NOT_ALLOWED',
  'ERR_JWS_INVALID',
  'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
  'ERR_JWT_CLAIM_VALIDATION_FAILED',
  'ERR_JWT_EXPIRED',
  'ERR_JWT_INVALID',
  'ERR_JWKS_NO_MATCHING_KEY',
]);

function isJwtAuthError(error: unknown): boolean {
  if (error instanceof UnauthorizedError) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string' && JWT_AUTH_ERROR_CODES.has(code)) {
    return true;
  }

  return JWT_AUTH_ERROR_NAMES.has(error.name);
}

/** Quick base64url JSON decode (parsing only, not validation) */
function decodePayload<T>(jwt: string): T {
  const [, payload] = jwt.split('.');
  if (!payload) {
    throw new UnauthorizedError('Invalid JWT');
  }

  let json: string;
  try {
    json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  } catch {
    throw new UnauthorizedError('Invalid JWT');
  }

  try {
    return JSON.parse(json) as T;
  } catch {
    throw new UnauthorizedError('Invalid JWT');
  }
}

export async function validateRequestToken(request: NextRequest) {
  const rawAuthToken = request.headers.get('Authorization');
  if (!rawAuthToken) {
    throw new UnauthorizedError();
  }

  const tokenSegments = rawAuthToken.split(' ');
  if (
    tokenSegments.length !== 2 ||
    tokenSegments[0].toLocaleLowerCase() !== 'bearer'
  ) {
    throw new UnauthorizedError();
  }
  const authToken = tokenSegments[1];
  if (!authToken) {
    throw new UnauthorizedError();
  }

  return await validateToken(authToken);
}

export async function validateToken(token: string): Promise<JWTPayload> {
  const expectedAudience = process.env.AZURE_AD_AUDIENCE;
  if (!expectedAudience) {
    throw new Error('Missing AZURE_AD_AUDIENCE env var');
  }

  try {
    const { payload } = await verifyAzureJwtFlexible(token, expectedAudience);
    return payload;
  } catch (error) {
    if (isJwtAuthError(error)) {
      throw new UnauthorizedError(
        error instanceof Error ? error.message : 'Unauthorized',
      );
    }
    throw error;
  }
}

export async function validateTokenOrNull(
  token: string,
  operation: string,
): Promise<JWTPayload | null> {
  try {
    const payload = await validateToken(token);
    return payload ?? null;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      logger.debug('Token validation rejected during', operation, error.message);
      return null;
    }
    throw error;
  }
}

/**
 * Verifies Azure AD tokens across:
 * - v1 (issuer: https://sts.windows.net/<tid>/)
 * - v2 (issuer: https://login.microsoftonline.com/<tid>/v2.0)
 * - CIAM/B2C (issuer host ends with ciamlogin.com/b2clogin.com)
 */
export async function verifyAzureJwtFlexible(
  token: string,
  expectedAudience: string,
) {
  const { iss, tid } = decodePayload<{ iss: string; tid?: string }>(token);
  if (!iss) {
    throw new UnauthorizedError('Missing iss');
  }

  let issuerUrl: URL;
  try {
    issuerUrl = new URL(iss);
  } catch {
    throw new UnauthorizedError('Invalid iss');
  }

  let wellKnown: string;
  if (issuerUrl.host === 'sts.windows.net') {
    const tenantId = issuerUrl.pathname.split('/').filter(Boolean)[0] || tid;
    if (!tenantId) {
      throw new UnauthorizedError('Cannot infer tenant id for v1 token');
    }
    wellKnown = `https://login.microsoftonline.com/${tenantId}/.well-known/openid-configuration`;
  } else if (
    issuerUrl.host.endsWith('b2clogin.com') ||
    issuerUrl.host.endsWith('ciamlogin.com')
  ) {
    wellKnown = new URL(
      '.well-known/openid-configuration',
      iss.endsWith('/') ? iss : `${iss}/`,
    ).toString();
  } else {
    wellKnown = new URL(
      '.well-known/openid-configuration',
      iss.endsWith('/') ? iss : `${iss}/`,
    ).toString();
  }

  const cfgRes = await fetch(wellKnown, { cache: 'no-store' });
  if (!cfgRes.ok) {
    throw new Error(
      `OIDC discovery failed: ${cfgRes.status} ${cfgRes.statusText}`,
    );
  }
  const cfg = (await cfgRes.json()) as { issuer: string; jwks_uri: string };

  const jwks = createRemoteJWKSet(new URL(cfg.jwks_uri));
  const { payload, protectedHeader } = await jwtVerify(token, jwks, {
    issuer: cfg.issuer,
    audience: expectedAudience,
  });

  return { payload, header: protectedHeader, issuer: cfg.issuer };
}
