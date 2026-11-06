'use client';

import { logger } from '@/lib/logger';
import {
  type CaseMap,
  type OriginalCaseRecordRequest,
  UserAccountModel,
} from '@/lib/types';
import { type AccountInfo } from '@azure/msal-browser';
import { useEffect, useReducer, useState } from 'react';
import { useAuth } from './useAuth';

const accountCasesCache = new Map<string, CaseMap[]>();
const accountCasesInFlight = new Map<string, Promise<CaseMap[] | null>>();

export function clearAccountCasesCache(): void {
  accountCasesCache.clear();
  accountCasesInFlight.clear();
}

function getAccountCasesCacheKey(account: AccountInfo | null): string | null {
  if (!account) {
    return null;
  }

  return account.homeAccountId || account.localAccountId || account.username;
}

function normalizeFetchErrorMessage(
  status: number,
  statusText: string,
  details?: string,
): string {
  if (details && details.trim().length > 0) {
    return details;
  }

  return `${status} ${statusText}`;
}

export function useAccountCases(options?: { enabled?: boolean }) {
  const { fetchWithAuth, isAuthenticated, account } = useAuth();
  const enabled = options?.enabled ?? true;

  const cacheKey = getAccountCasesCacheKey(account);

  const [cases, setCases] = useState<CaseMap[]>([]);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, refresh] = useReducer(
    (counter: number) => counter + 1,
    0,
  );

  useEffect(() => {
    if (!cacheKey) {
      return;
    }

    const handleCasesChanged = () => {
      accountCasesCache.delete(cacheKey);
      accountCasesInFlight.delete(cacheKey);
      refresh();
    };

    globalThis.addEventListener('account:cases-changed', handleCasesChanged);
    return () => {
      globalThis.removeEventListener('account:cases-changed', handleCasesChanged);
    };
  }, [cacheKey, refresh]);

  useEffect(() => {
    if (!enabled || !isAuthenticated || !cacheKey) {
      setCases([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    if (refreshCounter > 0) {
      accountCasesCache.delete(cacheKey);
      accountCasesInFlight.delete(cacheKey);
    }

    const cached = accountCasesCache.get(cacheKey);
    if (cached) {
      setCases(cached);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const inFlight = accountCasesInFlight.get(cacheKey);
    const request =
      inFlight ??
      (async () => {
        try {
          const response = await fetchWithAuth('/api/accounts/cases', {
            method: 'GET',
            cache: 'no-store',
          });

          if (!response.ok) {
            const details = await response.text();
            throw new Error(
              normalizeFetchErrorMessage(
                response.status,
                response.statusText,
                details,
              ),
            );
          }

          const raw = UserAccountModel.parseMany(await response.json());
          const parsedCases = raw.flatMap((entry) => entry.casesAccounts);
          accountCasesCache.set(cacheKey, parsedCases);
          return parsedCases;
        } catch (requestError) {
          logger.error('Error fetching account cases:', requestError);
          return null;
        } finally {
          accountCasesInFlight.delete(cacheKey);
        }
      })();

    if (!inFlight) {
      accountCasesInFlight.set(cacheKey, request);
    }

    request
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setCases([]);
          setError('Failed to fetch account cases');
          return;
        }

        setCases(result);
        setError(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, enabled, fetchWithAuth, isAuthenticated, refreshCounter]);

  async function createCase(payload: OriginalCaseRecordRequest) {
    const response = await fetchWithAuth('/api/accounts/cases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const details = await response.text();
      const message = normalizeFetchErrorMessage(
        response.status,
        response.statusText,
        details,
      );
      setError(message);
      return { ok: false as const, error: message };
    }

    if (cacheKey) {
      accountCasesCache.delete(cacheKey);
      accountCasesInFlight.delete(cacheKey);
    }

    refresh();
    return { ok: true as const };
  }

  return {
    cases,
    loading,
    error,
    refresh,
    createCase,
  };
}
