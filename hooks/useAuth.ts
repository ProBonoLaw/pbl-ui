'use client';
import { logger } from '@/lib/logger';

import { GraphUser, parseGraphUser } from '@/lib/types';
import {
  EventType,
  InteractionRequiredAuthError,
  type AccountInfo,
  type AuthenticationResult,
} from '@azure/msal-browser';
import { useMsal } from '@azure/msal-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const profileCache = new Map<string, GraphUser>();
const profileRequestCache = new Map<string, Promise<GraphUser | null>>();
const profilePhotoCache = new Map<string, string | null>();
const profilePhotoRequestCache = new Map<string, Promise<string | null>>();
const accountsEnableAttempted = new Set<string>();
const accountsEnableInFlight = new Map<string, Promise<void>>();
const accountsEnableStoragePrefix = 'accountsEnableAttempted:';
const DEFAULT_SCOPES = process.env.NEXT_PUBLIC_AAD_API_SCOPE
  ? process.env.NEXT_PUBLIC_AAD_API_SCOPE.split(',')
  : ['openid', 'profile'];

function getAccountCacheKey(account: AccountInfo | null): string | null {
  if (!account) {
    return null;
  }

  return account.homeAccountId || account.localAccountId || account.username;
}

function revokePhotoUrl(photoUrl: string | null | undefined): void {
  if (photoUrl && photoUrl.startsWith('blob:')) {
    URL.revokeObjectURL(photoUrl);
  }
}

function clearProfileCachesForKey(cacheKey: string): void {
  profileCache.delete(cacheKey);
  profileRequestCache.delete(cacheKey);

  const cachedPhoto = profilePhotoCache.get(cacheKey);
  revokePhotoUrl(cachedPhoto);
  profilePhotoCache.delete(cacheKey);
  profilePhotoRequestCache.delete(cacheKey);
}

function clearAllProfileCaches(): void {
  for (const photoUrl of profilePhotoCache.values()) {
    revokePhotoUrl(photoUrl);
  }

  profileCache.clear();
  profileRequestCache.clear();
  profilePhotoCache.clear();
  profilePhotoRequestCache.clear();
}

function getAccountsEnableStorageKey(cacheKey: string): string {
  return `${accountsEnableStoragePrefix}${cacheKey}`;
}

function hasAccountsEnableAttempted(cacheKey: string): boolean {
  if (accountsEnableAttempted.has(cacheKey)) {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  return (
    window.sessionStorage.getItem(getAccountsEnableStorageKey(cacheKey)) ===
    'true'
  );
}

function markAccountsEnableAttempted(cacheKey: string): void {
  accountsEnableAttempted.add(cacheKey);

  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(
      getAccountsEnableStorageKey(cacheKey),
      'true',
    );
  }
}

function markAccountsEnableAttemptedUntilReload(cacheKey: string): void {
  accountsEnableAttempted.add(cacheKey);
}

function clearAccountsEnableAttempted(cacheKey: string): void {
  accountsEnableAttempted.delete(cacheKey);
  accountsEnableInFlight.delete(cacheKey);

  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(getAccountsEnableStorageKey(cacheKey));
  }
}

function clearAllAccountsEnableAttempted(): void {
  accountsEnableAttempted.clear();
  accountsEnableInFlight.clear();

  if (typeof window === 'undefined') {
    return;
  }

  const keysToRemove: string[] = [];
  for (let i = 0; i < window.sessionStorage.length; i += 1) {
    const key = window.sessionStorage.key(i);
    if (key?.startsWith(accountsEnableStoragePrefix)) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    window.sessionStorage.removeItem(key);
  }
}

export function useAuth() {
  const { instance, accounts } = useMsal();
  const initial: AccountInfo | null =
    instance.getActiveAccount() ?? accounts[0] ?? null;

  const [account, setAccount] = useState<AccountInfo | null>(initial);
  const isAuthenticated = !!account;

  useEffect(() => {
    const id = instance.addEventCallback((e) => {
      switch (e.eventType) {
        case EventType.LOGIN_SUCCESS:
        case EventType.ACCOUNT_ADDED:
        case EventType.ACQUIRE_TOKEN_SUCCESS:
        case EventType.SSO_SILENT_SUCCESS: {
          const authResult = e.payload as AuthenticationResult | undefined;
          const acc =
            authResult?.account ??
            instance.getActiveAccount() ??
            instance.getAllAccounts()[0] ??
            null;
          if (
            acc &&
            acc.homeAccountId !== instance.getActiveAccount()?.homeAccountId
          ) {
            instance.setActiveAccount(acc);
          }

          if (acc && account?.homeAccountId !== acc.homeAccountId) {
            setAccount(acc);
          }
          break;
        }
        case EventType.LOGOUT_SUCCESS:
        case EventType.ACCOUNT_REMOVED: {
          const acc =
            instance.getActiveAccount() ?? instance.getAllAccounts()[0] ?? null;
          setAccount(acc);
          break;
        }
      }
    });
    return () => {
      if (id) instance.removeEventCallback(id);
    };
  }, [instance, account]);

  const getToken = useCallback(
    async (scopes: string[]) => {
      if (!account) {
        throw new Error('No active account');
      }

      try {
        const { accessToken } = await instance.acquireTokenSilent({
          scopes,
          account,
        });
        return accessToken;
      } catch (e) {
        // If user interaction is required (first time / expired consent), redirect:
        if (e instanceof InteractionRequiredAuthError) {
          await instance.loginRedirect({ scopes, account });
        }
        throw e;
      }
    },
    [account, instance],
  );

  const [isAttorney, setIsAttorney] = useState<boolean>(false);
  const activeAccountCacheKeyRef = useRef<string | null>(
    getAccountCacheKey(account),
  );

  useEffect(() => {
    activeAccountCacheKeyRef.current = getAccountCacheKey(account);
  }, [account]);

  const setCachedProfile = (
    profile: GraphUser | null,
    cacheKeyOverride?: string | null,
  ) => {
    const cacheKey = cacheKeyOverride ?? getAccountCacheKey(account);
    if (!cacheKey) {
      return;
    }

    const isActiveAccount = activeAccountCacheKeyRef.current === cacheKey;

    if (!profile) {
      profileCache.delete(cacheKey);
      if (isActiveAccount) {
        setIsAttorney(false);
      }
      return;
    }

    profileCache.set(cacheKey, profile);
    if (isActiveAccount) {
      setIsAttorney(
        profile.isAttorney === true,
      );
    }
  };

  const invalidateCachedProfile = () => {
    const cacheKey = getAccountCacheKey(account);
    if (!cacheKey) {
      return;
    }

    profileCache.delete(cacheKey);
    profileRequestCache.delete(cacheKey);
    setIsAttorney(false);
  };

  const setCachedProfilePhoto = (
    photoUrl: string | null,
    cacheKeyOverride?: string | null,
  ) => {
    const cacheKey = cacheKeyOverride ?? getAccountCacheKey(account);
    if (!cacheKey) {
      return;
    }

    const cachedPhoto = profilePhotoCache.get(cacheKey);
    if (cachedPhoto && cachedPhoto !== photoUrl) {
      revokePhotoUrl(cachedPhoto);
    }

    profilePhotoCache.set(cacheKey, photoUrl);
  };

  const invalidateCachedProfilePhoto = () => {
    const cacheKey = getAccountCacheKey(account);
    if (!cacheKey) {
      return;
    }

    const cachedPhoto = profilePhotoCache.get(cacheKey);
    revokePhotoUrl(cachedPhoto);
    profilePhotoCache.delete(cacheKey);
    profilePhotoRequestCache.delete(cacheKey);
  };

  const getProfile = async (): Promise<GraphUser | null> => {
    const cacheKey = getAccountCacheKey(account);
    if (!cacheKey) {
      return null;
    }

    const cachedProfile = profileCache.get(cacheKey);
    if (cachedProfile) {
      return cachedProfile;
    }

    const inFlightRequest = profileRequestCache.get(cacheKey);
    if (inFlightRequest) {
      return inFlightRequest;
    }

    const request = (async () => {
      const token = await getToken(['User.Read']);
      const response = await fetch('https://graph.microsoft.com/beta/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        logger.error('Failed to fetch profile:', await response.text());
        throw new Error(`Failed to fetch profile: ${response.statusText}`);
      }

      try {
        const rawProfile = parseGraphUser(await response.json());
        setCachedProfile(rawProfile, cacheKey);
        return rawProfile;
      } catch (error) {
        logger.error('Failed to parse profile response:', error);
        throw new Error('Failed to parse profile response', { cause: error });
      }
    })();

    profileRequestCache.set(cacheKey, request);

    try {
      return await request;
    } catch (error) {
      logger.error('Error fetching user profile:', error);
      return null;
    } finally {
      profileRequestCache.delete(cacheKey);
    }
  };

  const getProfilePhoto = async (): Promise<string | null> => {
    const cacheKey = getAccountCacheKey(account);
    if (!cacheKey) {
      return null;
    }

    if (profilePhotoCache.has(cacheKey)) {
      return profilePhotoCache.get(cacheKey) ?? null;
    }

    const inFlightRequest = profilePhotoRequestCache.get(cacheKey);
    if (inFlightRequest) {
      return inFlightRequest;
    }

    const request = (async () => {
      const token = await getToken(['User.Read']);
      const response = await fetch(
        'https://graph.microsoft.com/beta/me/photo/$value',
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) {
        if (response.status === 404) {
          setCachedProfilePhoto(null, cacheKey);
          return null;
        }
        throw new Error(`Failed to fetch profile: ${response.statusText}`);
      }

      const rawPhoto = await response.blob();
      if (!response.headers.get('content-type')?.startsWith('image/')) {
        setCachedProfilePhoto(null, cacheKey);
        return null;
      }

      const photoUrl = URL.createObjectURL(rawPhoto);
      setCachedProfilePhoto(photoUrl, cacheKey);
      return photoUrl;
    })();

    profilePhotoRequestCache.set(cacheKey, request);

    try {
      return await request;
    } catch (error) {
      logger.error('Error fetching user profile photo:', error);
      return null;
    } finally {
      profilePhotoRequestCache.delete(cacheKey);
    }
  };

  const fetchWithAuth = useCallback(
    async (
      input: RequestInfo,
      init?: RequestInit,
      scopes: string[] = DEFAULT_SCOPES,
    ) => {
      const token = await getToken(scopes);
      const headers = new Headers(init?.headers || {});
      headers.set('Authorization', 'Bearer ' + token);
      const modifiedInit = { ...init, headers };
      return fetch(input, modifiedInit);
    },
    [getToken],
  );

  const getProfileRef = useRef(getProfile);
  const fetchWithAuthRef = useRef(fetchWithAuth);

  useEffect(() => {
    getProfileRef.current = getProfile;
    fetchWithAuthRef.current = fetchWithAuth;
  });

  useEffect(() => {
    const email = account?.username;
    const cacheKey = getAccountCacheKey(account);
    if (!email || !cacheKey) {
      return;
    }

    if (hasAccountsEnableAttempted(cacheKey)) {
      return;
    }

    if (accountsEnableInFlight.has(cacheKey)) {
      return;
    }

    const request = (async () => {
      try {
        const response = await fetchWithAuthRef.current(
          '/api/accounts/cases/enable',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ emailAddress: email }),
          },
        );
        if (response.status === 404) {
          logger.info(
            'Unable to link accounts as their are no cases associated with user:',
            await response.text(),
          );
          markAccountsEnableAttempted(cacheKey);
        } else if (!response.ok) {
          logger.error('Error enabling accounts:', await response.text());
          markAccountsEnableAttemptedUntilReload(cacheKey);
        } else {
          logger.info('Accounts enabled successfully');
          markAccountsEnableAttempted(cacheKey);
        }
      } catch (error) {
        logger.error('Error enabling accounts:', error);
        markAccountsEnableAttemptedUntilReload(cacheKey);
      } finally {
        accountsEnableInFlight.delete(cacheKey);
      }
    })();

    accountsEnableInFlight.set(cacheKey, request);
  }, [account]);

  const signIn = () =>
    instance.loginRedirect({
      scopes: ['User.ReadWrite.All'],
      prompt: 'select_account',
    });

  const signOut = () => {
    const cacheKey = getAccountCacheKey(account);
    if (cacheKey) {
      clearProfileCachesForKey(cacheKey);
      clearAccountsEnableAttempted(cacheKey);
    } else {
      clearAllProfileCaches();
      clearAllAccountsEnableAttempted();
    }
    return instance.logoutRedirect();
  };

  useEffect(() => {
    if (!account) {
      setIsAttorney(false);
      return;
    }

    const requestCacheKey = getAccountCacheKey(account);
    (async () => {
      try {
        const profile = await getProfileRef.current();
        if (
          !requestCacheKey ||
          activeAccountCacheKeyRef.current !== requestCacheKey
        ) {
          return;
        }
        setIsAttorney(
          profile?.isAttorney ===
            true,
        );
      } catch (error) {
        if (
          !requestCacheKey ||
          activeAccountCacheKeyRef.current !== requestCacheKey
        ) {
          return;
        }
        logger.error('Error fetching user role:', error);
        setIsAttorney(false);
      }
    })();
  }, [account]);

  return {
    isAuthenticated,
    account,
    signIn,
    signOut,
    getToken,
    getProfile,
    getProfilePhoto,
    fetchWithAuth,
    isAttorney,
    setCachedProfile,
    invalidateCachedProfile,
    setCachedProfilePhoto,
    invalidateCachedProfilePhoto,
  };
}
