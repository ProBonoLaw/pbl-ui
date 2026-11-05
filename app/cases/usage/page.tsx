'use client';
import { logger } from '@/lib/logger';
import AuthGuard from '@/components/AuthGuard';
import PageTemplate from '@/components/PageTemplate';
import DataTableSurface from '@/components/tables/DataTableSurface';
import { useAccountAccess } from '@/hooks/useAccountAccess';
import { useAuth } from '@/hooks/useAuth';
import { printTitle } from '@/lib/caseUtils';
import { CaseMap, CaseMapModel, LLMUsageEntry } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useState } from 'react';
export default function Usage() {
  const { fetchWithAuth } = useAuth();
  const {
    access,
    loading: loadingAccess,
    error: accessError,
  } = useAccountAccess();
  const redirect = useRouter();
  const [data, setData] = useState<CaseMap[] | undefined>(undefined);
  const [loading, setLoading] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (loading !== undefined || loadingAccess) {
      return;
    }

    if (accessError || !access || access.agreedToTerms === false) {
      setLoading(false);
      redirect.replace('/');
      return;
    }

    setLoading(true);
    const fetchUsage = async () => {
      try {
        const res = await fetchWithAuth('/api/accounts/cases/usage', {
          method: 'GET',
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          setData(CaseMapModel.parseMany(data));
        } else {
          logger.error(
            'Failed to fetch usage data:',
            res.status,
            res.statusText,
          );
        }
      } catch (error) {
        logger.error('Error fetching usage data:', error);
      } finally {
        setLoading(false);
        logger.info('Finished fetching usage data');
      }
    };
    fetchUsage();
  }, [access, accessError, fetchWithAuth, loading, loadingAccess, redirect]);

  const generatedCost = (usage: LLMUsageEntry, billingCode?: string) => {
    // USD per million tokens. GPT-5.6 uses Azure Global short-context pricing;
    // Azure links Claude Consumption Unit pricing to Anthropic's standard rates.
    // https://azure.microsoft.com/en-us/pricing/details/azure-openai/
    // https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/claude-models-billing
    const inputPricePer1M = () => {
      switch (usage.model) {
        case 'gpt-4o':
          return 2.5;
        case 'gpt-4o-mini':
          return 0.15;
        case 'gpt-5-nano':
          return 0.05;
        case 'gpt-5-mini':
          return 0.25;
        case 'gpt-5':
          return 1.25;
        case 'gpt-5.1':
          return 1.25;
        case 'gpt-5.2':
          return 1.75;
        case 'gpt-5.6-luna':
          return 0.2;
        case 'gpt-5.6-terra':
          return 2;
        case 'gpt-5.6-sol':
          return 4;
        case 'fact-finder-gpt-5.4-mini':
          return 0.75;
        case 'claude-haiku-4-5':
          return 1;
        case 'claude-sonnet-5':
          return 2;
        case 'claude-opus-5':
          return 5;
        case 'text-embedding-3-large':
          return 0.13;
        case 'text-embedding-3-small':
          return 0.02;
        default:
          return 0;
      }
    };
    const outputPricePer1M = () => {
      switch (usage.model) {
        case 'gpt-4o':
          return 10.0;
        case 'gpt-4o-mini':
          return 0.6;
        case 'gpt-5-nano':
          return 0.4;
        case 'gpt-5-mini':
          return 2.0;
        case 'gpt-5':
          return 10.05;
        case 'gpt-5.1':
          return 10.05;
        case 'gpt-5.2':
          return 14.0;
        case 'gpt-5.6-luna':
          return 1.2;
        case 'gpt-5.6-terra':
          return 12;
        case 'gpt-5.6-sol':
          return 20;
        case 'fact-finder-gpt-5.4-mini':
          return 4.5;
        case 'claude-haiku-4-5':
          return 5;
        case 'claude-sonnet-5':
          return 10;
        case 'claude-opus-5':
          return 25;
        default:
          return 0;
      }
    };
    if (billingCode === 'S1') {
      // To be replaced with actual cost calculation logic
      const costPer1MInputTokens = inputPricePer1M();
      const costPer1MOutputTokens = outputPricePer1M();
      const inputCost = (usage.inputTokens / 1_000_000) * costPer1MInputTokens;
      const outputCost =
        (usage.outputTokens / 1_000_000) * costPer1MOutputTokens;
      return `$${(inputCost + outputCost).toFixed(2)}`;
    } else if (billingCode?.startsWith('G')) {
      return 'Included in price';
    }

    return 'Unknown';
  };

  function renderUsageSummaryRow(caseAccount: CaseMap) {
    return (
      <tr className="border-t font-semibold">
        <td colSpan={3} className="italic pl-4 pb-6">
          Grand Total
        </td>
        <td className="px-3 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400 pb-6">
          {caseAccount.llmUsage
            ?.reduce((sum, usage) => sum + usage.inputTokens, 0)
            .toLocaleString()}
        </td>
        <td className="px-3 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400 pb-6">
          {caseAccount.llmUsage
            ?.reduce((sum, usage) => sum + usage.outputTokens, 0)
            .toLocaleString()}
        </td>
        <td className="px-3 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400 pb-6">
          {caseAccount.llmUsage
            ?.reduce((sum, usage) => sum + usage.reasoningTokens, 0)
            .toLocaleString()}
        </td>
        <td className="px-3 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400 pb-6">
          $
          {caseAccount.llmUsage
            ?.reduce((totalCost, usage) => {
              const costStr = generatedCost(usage, caseAccount.billingCode);
              const costNum = parseFloat(costStr.replace('$', ''));
              return totalCost + (isNaN(costNum) ? 0 : costNum);
            }, 0)
            .toFixed(2)}
        </td>
        <td className="px-3 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400 pb-6">
          {caseAccount.llmUsage
            ?.reduce((sum, usage) => sum + usage.totalTokens, 0)
            .toLocaleString()}
        </td>
      </tr>
    );
  }

  function getUsageType(usage: LLMUsageEntry) {
    switch (usage.origin) {
      case 'AIMIE':
        return 'User Interaction';
      case 'Ingress':
        return 'Document Onboarding';
      default:
        return 'Unknown';
    }
  }

  return (
    <AuthGuard>
      <PageTemplate
        title="Token Usage"
        isLoading={loading}
        className="md:w-7xl">
        <div className="overflow-x-hidden">
          <DataTableSurface>
              <thead className="bg-white dark:bg-gray-900">
                <tr>
                  <th
                    scope="col"
                    className="py-3.5 pr-3 pl-4 text-left text-sm font-semibold text-gray-900 sm:pl-3 dark:text-white">
                    Origin
                  </th>
                  <th
                    scope="col"
                    className="py-3.5 pr-3 pl-4 text-left text-sm font-semibold text-gray-900 sm:pl-3 dark:text-white">
                    Model
                  </th>
                  <th
                    scope="col"
                    className="py-3.5 pr-3 pl-4 text-left text-sm font-semibold text-gray-900 sm:pl-3 dark:text-white">
                    LLM Type
                  </th>
                  <th
                    scope="col"
                    className="py-3.5 pr-3 pl-4 text-left text-sm font-semibold text-gray-900 sm:pl-3 dark:text-white">
                    Input Tokens
                  </th>
                  <th
                    scope="col"
                    className="py-3.5 pr-3 pl-4 text-left text-sm font-semibold text-gray-900 sm:pl-3 dark:text-white">
                    Output Tokens
                  </th>
                  <th
                    scope="col"
                    className="py-3.5 pr-3 pl-4 text-left text-sm font-semibold text-gray-900 sm:pl-3 dark:text-white">
                    Reasoning Tokens
                  </th>
                  <th
                    scope="col"
                    className="py-3.5 pr-3 pl-4 text-left text-sm font-semibold text-gray-900 sm:pl-3 dark:text-white">
                    Cost
                  </th>
                  <th
                    scope="col"
                    className="py-3.5 pr-3 pl-4 text-left text-sm font-semibold text-gray-900 sm:pl-3 dark:text-white">
                    Total Tokens
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900">
                {(!data || data.length === 0) && (
                  <tr><td colSpan={8}>No usage data available.</td></tr>
                )}
                {data?.map((caseAccount) => (
                  <Fragment key={caseAccount.accountId}>
                    <tr className="border-t border-gray-200 dark:border-white/10">
                      <th
                        scope="colgroup"
                        colSpan={8}
                        className="bg-gray-50 py-2 pr-3 pl-4 text-left text-sm font-semibold text-gray-900 sm:pl-3 dark:bg-gray-800/50 dark:text-white">
                        {printTitle(caseAccount.record)} (
                        {caseAccount.caseNumber ?? caseAccount.accountId})
                      </th>
                    </tr>
                    {(caseAccount.llmUsage?.length || 0) > 0 ? (
                      <>
                        {caseAccount.llmUsage?.map((usage) => (
                          <tr
                            key={
                              usage.model +
                              usage.accountId +
                              usage.llmType +
                              usage.origin
                            }>
                            <td className="px-3 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                              {getUsageType(usage)}
                            </td>
                            <td className="px-3 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                              {usage.model}
                            </td>
                            <td className="px-3 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                              {usage.llmType === 'azure-openai-chat'
                                ? 'Azure OpenAI'
                                : usage.llmType}
                            </td>
                            <td className="px-3 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                              {usage.inputTokens.toLocaleString()}
                            </td>
                            <td className="px-3 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                              {usage.outputTokens.toLocaleString()}
                            </td>
                            <td className="px-3 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                              {usage.reasoningTokens.toLocaleString()}
                            </td>
                            <td className="px-3 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                              {generatedCost(usage, caseAccount.billingCode)}
                            </td>
                            <td className="px-3 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                              {usage.totalTokens.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        {renderUsageSummaryRow(caseAccount)}
                      </>
                    ) : (
                      <tr>
                        <td colSpan={8} className="italic pl-4 py-4">
                          No LLM usage data available.
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
          </DataTableSurface>
        </div>
      </PageTemplate>
    </AuthGuard>
  );
}
