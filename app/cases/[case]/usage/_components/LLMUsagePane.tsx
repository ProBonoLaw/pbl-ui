import { LLMUsageLLMTypesType } from '@/lib/types';

export function LLMUsagePane({
  name,
  llmTypeRecord,
}: {
  name: string;
  llmTypeRecord: LLMUsageLLMTypesType;
}) {
  const stats = [
    {
      id: 'input-tokens',
      name: 'Input Tokens',
      value: llmTypeRecord.totalInputTokens,
    },
    {
      id: 'output-tokens',
      name: 'Output Tokens',
      value: llmTypeRecord.totalOutputTokens,
    },
    {
      id: 'reasoning-tokens',
      name: 'Reasoning Tokens',
      value: llmTypeRecord.totalReasoningTokens,
    },
    {
      id: 'overall-tokens',
      name: 'Overall Total Tokens',
      value: llmTypeRecord.overallTotalTokens,
    },
  ];
  return (
    llmTypeRecord && (
      <div className="bg-white py-8 md:py-12 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            {name}
          </h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-16 text-center lg:grid-cols-4 border-t border-gray-200 pt-10 dark:border-gray-700">
            {stats.map((stat) => (
              <div
                key={stat.id}
                className="mx-auto flex max-w-xs flex-col gap-y-4">
                <dt className="text-base/7 text-gray-600 dark:text-gray-400">
                  {stat.name}
                </dt>
                <dd className="order-first text-3xl font-semibold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
                  {stat.value.toLocaleString()}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    )
  );
}
