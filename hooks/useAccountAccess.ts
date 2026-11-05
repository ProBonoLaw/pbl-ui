'use client';

import { logger } from '@/lib/logger';
import {
  parseUserAccessStateResponse,
  type UserAccessStateResponse,
} from '@/lib/types';
import { type AccountInfo } from '@azure/msal-browser';
import { useEffect, useReducer, useState } from 'react';
import { useAuth } from './useAuth';

const accountAccessCache = new Map<string, UserAccessStateResponse>();
const accountAccessInFlight = new Map<
  string,
  Promise<UserAccessStateResponse | null>
>();

function getAccountAccessCacheKey(account: AccountInfo | null): string | null {
  if (!account) {
    return null;
  }

  return account.homeAccountId || account.localAccountId || account.username;
}

export function useAccountAccess(options?: { enabled?: boolean }) {
  const { fetchWithAuth, isAuthenticated, account } = useAuth();
  const enabled = options?.enabled ?? true;

  const cacheKey = getAccountAccessCacheKey(account);

  const [access, setAccess] = useState<UserAccessStateResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, refresh] = useReducer(
    (counter: number) => counter + 1,
    0,
  );

  useEffect(() => {
    if (!enabled || !isAuthenticated || !cacheKey) {
      setAccess(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    if (refreshCounter > 0) {
      accountAccessCache.delete(cacheKey);
      accountAccessInFlight.delete(cacheKey);
    }

    const cached = accountAccessCache.get(cacheKey);
    if (cached) {
      setAccess(cached);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const inFlight = accountAccessInFlight.get(cacheKey);
    const request =
      inFlight ??
      (async () => {
        try {
          const response = await fetchWithAuth('/api/accounts/access', {
            method: 'GET',
            cache: 'no-store',
          });

          if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
          }

          const parsed = parseUserAccessStateResponse(await response.json());
          accountAccessCache.set(cacheKey, parsed);
          return parsed;
        } catch (requestError) {
          logger.error('Error fetching account access state:', requestError);
          return null;
        } finally {
          accountAccessInFlight.delete(cacheKey);
        }
      })();

    if (!inFlight) {
      accountAccessInFlight.set(cacheKey, request);
    }

    request
      .then((result) => {
        if (cancelled) {
          return;
        }

        setAccess(result);
        setError(result ? null : 'Failed to fetch account access state');
      })
      .catch((requestError) => {
        if (cancelled) {
          return;
        }

        setAccess(null);
        setError((requestError as Error).message);
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

  useEffect(() => {
    if (!enabled || !isAuthenticated || !cacheKey) {
      return;
    }

    const refreshAccountAccess = (event: Event) => {
      const detail = (event as CustomEvent<{ scope?: string }>).detail;
      if (detail?.scope && detail.scope !== 'user-account') {
        return;
      }

      refresh();
    };

    window.addEventListener('account:initialized', refreshAccountAccess);
    window.addEventListener('terms:accepted', refreshAccountAccess);
    return () => {
      window.removeEventListener('account:initialized', refreshAccountAccess);
      window.removeEventListener('terms:accepted', refreshAccountAccess);
    };
  }, [cacheKey, enabled, isAuthenticated, refresh]);

  return {
    access,
    loading,
    error,
    refresh,
  };
}
