import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { OverallStats, parseOverallStats } from '@/lib/types';

export function useTokenUsage(
  caseId?: string | null,
  fromDate?: string | null,
  toDate?: string | null,
) {
  const { fetchWithAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenUsageSummary, setTokenUsageSummary] = useState<
    OverallStats | undefined
  >(undefined);

  useEffect(() => {
    if (!caseId) {
      setTokenUsageSummary(undefined);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setTokenUsageSummary(undefined);

    const queryParams = new URLSearchParams();
    if (fromDate) queryParams.append('from', fromDate);
    if (toDate) queryParams.append('to', toDate);

    fetchWithAuth(
      `/api/accounts/cases/${caseId}/usage/summary?${queryParams.toString()}`,
    )
      .then((response) => {
        if (!response.ok) {
          setError(`Error fetching usage summary: ${response.statusText}`);
          setLoading(false);
          return;
        }
        return response.json();
      })
      .then((data) => {
        if (data) {
          setTokenUsageSummary(parseOverallStats(data));
        }
      })
      .catch((err: Error) => {
        setError(`Error fetching usage summary: ${err.message}`);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [caseId, fromDate, toDate, fetchWithAuth]);

  return { tokenUsageSummary, loading, error };
}
