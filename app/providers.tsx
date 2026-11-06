'use client';
import { logger } from '@/lib/logger';

import { ensureMsalInitialized, msalInstance } from '@/lib/msal';
import { getRuntimeDependencies } from '@/lib/runtimeDependencies';
import { MsalProvider } from '@azure/msal-react';
import WidgetProvider, { type FormDataProps, useReactRoast } from 'react-roast';
import { ReactNode, useCallback, useEffect, useState } from 'react';

const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';
const DEFAULT_SCOPES = process.env.NEXT_PUBLIC_AAD_API_SCOPE
  ? process.env.NEXT_PUBLIC_AAD_API_SCOPE.split(',')
      .map((scope) => scope.trim())
      .filter((scope) => scope.length > 0)
  : ['openid', 'profile'];

type RuntimeMsalClient = ReturnType<
  typeof getRuntimeDependencies
>['msalClient'];
type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: () => void) => void;
  removeListener?: (listener: () => void) => void;
};

const ROAST_LIGHT_THEME: Record<string, string> = {
  '--rrn-clr-50': '#ffffff',
  '--rrn-clr-100': '#f9fafb',
  '--rrn-clr-200': '#e5e7eb',
  '--rrn-clr-300': '#d1d5db',
  '--rrn-clr-400': '#9ca3af',
  '--rrn-clr-500': '#6b7280',
  '--rrn-clr-600': '#4f46e5',
  '--rrn-clr-700': '#4338ca',
  '--rrn-clr-800': '#312e81',
  '--rrn-clr-900': '#111827',
};

const ROAST_DARK_THEME: Record<string, string> = {
  '--rrn-clr-50': '#111827',
  '--rrn-clr-100': '#1f2937',
  '--rrn-clr-200': '#374151',
  '--rrn-clr-300': '#4b5563',
  '--rrn-clr-400': '#9ca3af',
  '--rrn-clr-500': '#d1d5db',
  '--rrn-clr-600': '#818cf8',
  '--rrn-clr-700': '#a5b4fc',
  '--rrn-clr-800': '#e5e7eb',
  '--rrn-clr-900': '#f9fafb',
};

function resolveCaseIdFromPath(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'cases' && segments[1]) {
    return segments[1];
  }
  return EMPTY_UUID;
}

function RoastUserSync({ msalClient }: { msalClient: RuntimeMsalClient }) {
  const { setUser } = useReactRoast();

  useEffect(() => {
    const syncRoastUser = () => {
      const account =
        msalClient.getActiveAccount() ?? msalClient.getAllAccounts()[0] ?? null;

      if (account?.username) {
        setUser({
          id: account.localAccountId || account.homeAccountId || undefined,
          name: account.name || undefined,
          email: account.username,
        });
        return;
      }

      setUser({ email: '' });
    };

    syncRoastUser();

    const callbackId = msalClient.addEventCallback(() => {
      syncRoastUser();
    });

    return () => {
      if (callbackId) {
        msalClient.removeEventCallback(callbackId);
      }
    };
  }, [msalClient, setUser]);

  return null;
}

export default function Providers({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [isMobileFeedbackTab, setIsMobileFeedbackTab] = useState(false);
  const { msalClient } = getRuntimeDependencies();

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const mediaWithLegacySupport = media as LegacyMediaQueryList;

    const applyRoastTheme = () => {
      const isDark =
        root.classList.contains('dark') ||
        root.dataset.theme === 'dark' ||
        media.matches;
      const palette = isDark ? ROAST_DARK_THEME : ROAST_LIGHT_THEME;

      Object.entries(palette).forEach(([token, value]) => {
        root.style.setProperty(token, value, 'important');
      });
    };

    applyRoastTheme();

    const onMediaChange = () => applyRoastTheme();
    if (typeof mediaWithLegacySupport.addListener === 'function') {
      mediaWithLegacySupport.addListener(onMediaChange);
    } else {
      media.addEventListener('change', onMediaChange);
    }

    const observer = new MutationObserver((mutations) => {
      if (
        mutations.some(
          (mutation) =>
            mutation.type === 'attributes' &&
            (mutation.attributeName === 'class' ||
              mutation.attributeName === 'data-theme'),
        )
      ) {
        applyRoastTheme();
      }
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });

    return () => {
      observer.disconnect();
      if (typeof mediaWithLegacySupport.removeListener === 'function') {
        mediaWithLegacySupport.removeListener(onMediaChange);
      } else {
        media.removeEventListener('change', onMediaChange);
      }
    };
  }, []);

  const getFeedbackAuthHeader = useCallback(async (): Promise<
    string | null
  > => {
    const account =
      msalClient.getActiveAccount() ?? msalClient.getAllAccounts()[0] ?? null;

    if (!account) {
      return null;
    }

    try {
      const token = await msalClient.acquireTokenSilent({
        scopes: DEFAULT_SCOPES,
        account,
      });
      return token.accessToken ? `Bearer ${token.accessToken}` : null;
    } catch (error) {
      logger.debug('Unable to acquire token for feedback submission:', error);
      return null;
    }
  }, [msalClient]);

  const handleRoastSubmit = useCallback(
    async ({
      message,
      email,
      screenshotBlobs,
    }: FormDataProps): Promise<boolean> => {
      const trimmedMessage = message.trim();
      if (!trimmedMessage) {
        return false;
      }

      const caseId =
        typeof window !== 'undefined'
          ? resolveCaseIdFromPath(window.location.pathname)
          : EMPTY_UUID;

      try {
        const formData = new FormData();
        formData.set('message', trimmedMessage);

        if (email?.trim()) {
          formData.set('email', email.trim());
        }

        screenshotBlobs.forEach((screenshot, index) => {
          formData.append(
            'screenshots',
            screenshot.blob,
            `${screenshot.type}-${index}.png`,
          );
          formData.append('screenshotType', screenshot.type);
        });

        const authHeader = await getFeedbackAuthHeader();
        const headers = new Headers();
        if (authHeader) {
          headers.set('Authorization', authHeader);
        }

        const response = await fetch(
          `/api/accounts/cases/${encodeURIComponent(caseId)}/feedback`,
          {
            method: 'POST',
            headers,
            body: formData,
            cache: 'no-store',
          },
        );

        if (!response.ok) {
          logger.error(
            'React Roast feedback request failed:',
            response.status,
            response.statusText,
            await response.text(),
          );
          return false;
        }

        return true;
      } catch (error) {
        logger.error('React Roast feedback submit failed:', error);
        return false;
      }
    },
    [getFeedbackAuthHeader],
  );

  useEffect(() => {
    (async () => {
      if (msalClient === msalInstance) {
        await ensureMsalInitialized();
      } else {
        await msalClient.initialize();
      }
      await msalClient.handleRedirectPromise();
      // If you don’t explicitly set active account on every load, do it here:
      const active = msalClient.getActiveAccount();
      if (!active) {
        const all = msalClient.getAllAccounts();
        if (all[0]) msalClient.setActiveAccount(all[0]);
      }
      setReady(true);
    })().catch((e) => {
      logger.error('MSAL init failed:', e);
      setReady(true); // render anyway; your UI can show an error
    });
  }, [msalClient]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const mediaWithLegacySupport = media as LegacyMediaQueryList;

    const applyPlacement = () => {
      setIsMobileFeedbackTab(media.matches);
    };

    applyPlacement();

    if (typeof mediaWithLegacySupport.addListener === 'function') {
      mediaWithLegacySupport.addListener(applyPlacement);
      return () => {
        mediaWithLegacySupport.removeListener?.(applyPlacement);
      };
    }

    media.addEventListener('change', applyPlacement);
    return () => {
      media.removeEventListener('change', applyPlacement);
    };
  }, []);

  if (!ready) return null; // or a loading spinner/skeleton
  return (
    <MsalProvider instance={msalClient}>
      <WidgetProvider
        mode="local"
        onFormSubmit={handleRoastSubmit}
        customize={{
          island: {
            label: 'Feedback Mode',
            placement: isMobileFeedbackTab ? 'bottom-left' : 'right-center',
          },
          form: {
            submitButton: {
              label: 'Submit Feedback',
            },
            messageInput: {
              placeholder:
                "What's the issue?  The better you describe it, the better the product can get.",
            },
          },
        }}>
        <RoastUserSync msalClient={msalClient} />
        {children}
      </WidgetProvider>
    </MsalProvider>
  );
}
