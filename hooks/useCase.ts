import {
  getCachedCaseAccount,
  invalidateCachedCaseAccount,
} from '@/lib/caseAccountRequestCache';
import type { TermsOfServiceScope } from '@/lib/termsOfService';
import { OriginalCaseRecord, UserAccountModel } from '@/lib/types';
import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';

const getPersonName = (
  personInfo:
    | OriginalCaseRecord['personInformation']
    | OriginalCaseRecord['opposition']
    | null
    | undefined,
) => {
  if (!personInfo) return 'Unknown Individual';
  const { firstName, lastName } = personInfo;
  const names = [firstName, lastName].filter(Boolean).join(' ');
  return names || 'Unnamed Individual';
};

export function useCase(caseId?: string | null) {
  const { account, fetchWithAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [originalCaseRecord, setOriginalCaseRecord] =
    useState<UserAccountModel | null>(null);
  const accountCacheScope =
    account?.homeAccountId || account?.localAccountId || account?.username;

  useEffect(() => {
    if (!caseId) {
      setOriginalCaseRecord(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setOriginalCaseRecord(null);
    let canceled = false;

    getCachedCaseAccount({
      caseId,
      cacheScope: accountCacheScope,
      fetchWithAuth,
    })
      .then((caseData) => {
        if (canceled) {
          return;
        }
        setOriginalCaseRecord(caseData);
        setLoading(false);
      })
      .catch((err) => {
        if (canceled) {
          return;
        }
        setError(`Error fetching case data: ${err.message}`);
        setLoading(false);
      });

    return () => {
      canceled = true;
    };
  }, [accountCacheScope, fetchWithAuth, caseId]);

  useEffect(() => {
    if (!caseId) {
      return;
    }

    const onTermsAccepted = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          scope: TermsOfServiceScope;
          caseId?: string;
        }>
      ).detail;
      if (detail?.scope !== 'case' || detail.caseId !== caseId) {
        return;
      }

      invalidateCachedCaseAccount(caseId, accountCacheScope);
      setOriginalCaseRecord((current) => {
        if (!current) {
          return current;
        }

        return UserAccountModel.withCaseTermsAccepted(current, caseId);
      });
    };

    window.addEventListener('terms:accepted', onTermsAccepted);
    return () => {
      window.removeEventListener('terms:accepted', onTermsAccepted);
    };
  }, [accountCacheScope, caseId]);

  useEffect(() => {
    if (!caseId) {
      return;
    }

    const onCaseUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{
        caseId: string;
        caseAccount: UserAccountModel;
      }>).detail;
      if (detail?.caseId !== caseId) {
        return;
      }
      setOriginalCaseRecord(detail.caseAccount);
      setError(null);
    };

    globalThis.addEventListener('case:updated', onCaseUpdated);
    return () => globalThis.removeEventListener('case:updated', onCaseUpdated);
  }, [caseId]);

  const caseNumber =
    originalCaseRecord?.casesAccounts[0]?.record?.caseNumber ||
    'Unknown Case Number';

  let caseHeadliner = 'Unknown Case';
  if (originalCaseRecord) {
    const caseRecord = originalCaseRecord.casesAccounts[0].record;
    if (caseRecord) {
      if (caseRecord.nickname) {
        caseHeadliner = caseRecord.nickname;
      } else {
        const { personInformation, opposition, filingRole } = caseRecord;
        const firstSectionName =
          filingRole === 'plaintiff' || filingRole === 'petitioner'
            ? getPersonName(personInformation)
            : getPersonName(opposition);

        const secondSectionName =
          filingRole === 'plaintiff' || filingRole === 'petitioner'
            ? getPersonName(opposition)
            : getPersonName(personInformation);
        caseHeadliner = `${firstSectionName} vs. ${secondSectionName} (${caseRecord.caseNumber})`;
      }
    }
  }

  return { originalCaseRecord, caseNumber, caseHeadliner, error, loading };
}
