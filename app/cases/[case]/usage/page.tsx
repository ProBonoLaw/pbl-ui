'use client';
import CasePageTemplate from '@/components/cases/CasePageTemplate';
import { useAccountAccess } from '@/hooks/useAccountAccess';
import { useAuth } from '@/hooks/useAuth';
import { useTokenUsage } from '@/hooks/useTokenUsage';
import { UserAccountSchema } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LLMLocationUsagePane } from './_components/LLMLocationUsagePane';
import { QueryUsagePane } from './_components/QueryUsagePane';

export default function UsagePage({
  params,
}: {
  params: Promise<{ case: string }>;
}) {
  const { fetchWithAuth } = useAuth();
  const {
    access,
    loading: loadingAccess,
    error: accessError,
  } = useAccountAccess();
  const redirect = useRouter();
  const [caseId, setCaseId] = useState<string | null>(null);
  const [canViewUsage, setCanViewUsage] = useState<boolean>(false);
  const [checkingAccess, setCheckingAccess] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      const { case: caseId } = await params;
      setCaseId(caseId);
    })();
  }, [params]);

  useEffect(() => {
    if (!caseId || loadingAccess) {
      return;
    }

    let canceled = false;
    (async () => {
      try {
        if (accessError || !access || access.agreedToTerms === false) {
          if (!canceled) {
            setCanViewUsage(false);
            redirect.replace(`/cases/${caseId}`);
          }
          return;
        }

        const caseRes = await fetchWithAuth(`/api/accounts/cases/${caseId}`, {
          method: 'GET',
          cache: 'no-store',
        });
        if (!caseRes.ok) {
          throw new Error('Failed to check usage access');
        }

        const caseData = UserAccountSchema.parse(await caseRes.json());
        const caseAccess = caseData.casesAccounts[0];
        const isGuest = caseAccess?.isGuest === true;
        const hasAcceptedCaseTerms = caseAccess?.agreedToCaseTerms === true;
        const allowed = !isGuest && hasAcceptedCaseTerms;

        if (!canceled) {
          setCanViewUsage(allowed);
          if (!allowed) {
            redirect.replace(`/cases/${caseId}`);
          }
        }
      } catch {
        if (!canceled) {
          setCanViewUsage(false);
          redirect.replace(`/cases/${caseId}`);
        }
      } finally {
        if (!canceled) {
          setCheckingAccess(false);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [access, accessError, caseId, fetchWithAuth, loadingAccess, redirect]);

  const { tokenUsageSummary, loading, error } = useTokenUsage(
    canViewUsage ? caseId : null,
  );
  const summaryData = tokenUsageSummary
    ? Object.entries(tokenUsageSummary.llmStats.locations)
    : [];
  const usageResolved = !loading && !checkingAccess;
  const showNoUsageData =
    usageResolved &&
    canViewUsage &&
    !!caseId &&
    !error &&
    summaryData.length === 0;

  return (
    <CasePageTemplate
      title="Case Statistics"
      isLoading={loading || checkingAccess}
      params={params}>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {showNoUsageData && <p>No usage data available.</p>}
      {tokenUsageSummary && summaryData.length > 0 && (
        <div>
          <QueryUsagePane queryMetrics={tokenUsageSummary.queryTimingMetrics} />

          {summaryData.map(([location, models]) => (
            <LLMLocationUsagePane
              name={location}
              llmOriginRecord={models}
              key={location}
            />
          ))}
        </div>
      )}
    </CasePageTemplate>
  );
}
