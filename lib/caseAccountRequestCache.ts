import { UserAccountModel } from '@/lib/types';

export class CaseAccountRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'CaseAccountRequestError';
    this.status = status;
    this.code = code;
  }
}

type FetchWithAuth = (
  input: RequestInfo,
  init?: RequestInit,
) => Promise<Response>;

type GetCaseAccountRequest = Readonly<{
  caseId: string;
  cacheScope?: string | null;
  fetchWithAuth: FetchWithAuth;
}>;

const CASE_ACCOUNT_CACHE_TTL_MS = 5_000;

type CachedCaseAccount = Readonly<{
  expiresAt: number;
  value: UserAccountModel;
}>;

const caseAccountCache = new Map<string, CachedCaseAccount>();
const caseAccountInFlight = new Map<string, Promise<UserAccountModel>>();

function getCacheKey(caseId: string, cacheScope?: string | null): string {
  return `${cacheScope || 'anonymous'}:${caseId}`;
}

export async function getCachedCaseAccount({
  caseId,
  cacheScope,
  fetchWithAuth,
}: GetCaseAccountRequest): Promise<UserAccountModel> {
  const cacheKey = getCacheKey(caseId, cacheScope);
  const cached = caseAccountCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  if (cached) {
    caseAccountCache.delete(cacheKey);
  }

  const inFlight = caseAccountInFlight.get(cacheKey);
  if (inFlight !== undefined) {
    return inFlight;
  }

  const request = (async () => {
    const response = await fetchWithAuth('/api/accounts/cases/' + caseId, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      let errorCode: string | undefined;
      let errorMessage = String(response.status) + ' ' + response.statusText;
      try {
        const details = (await response.json()) as {
          error?: unknown;
          code?: unknown;
        };
        if (typeof details.error === 'string') {
          errorMessage = details.error;
        }
        if (typeof details.code === 'string') {
          errorCode = details.code;
        }
      } catch {
        // Keep the HTTP status message if the response is not JSON.
      }

      throw new CaseAccountRequestError(
        errorMessage,
        response.status,
        errorCode,
      );
    }

    const parsed = UserAccountModel.parse(await response.json());
    caseAccountCache.set(cacheKey, {
      expiresAt: Date.now() + CASE_ACCOUNT_CACHE_TTL_MS,
      value: parsed,
    });
    return parsed;
  })();

  caseAccountInFlight.set(cacheKey, request);

  try {
    return await request;
  } finally {
    caseAccountInFlight.delete(cacheKey);
  }
}

export function invalidateCachedCaseAccount(
  caseId: string,
  cacheScope?: string | null,
): void {
  const cacheKey = getCacheKey(caseId, cacheScope);
  caseAccountCache.delete(cacheKey);
  caseAccountInFlight.delete(cacheKey);
}
