import { LLMUsageOriginTypesType } from '@/lib/types';
import { LLMUsagePane } from './LLMUsagePane';

export function convertLLMTypeName(name: string) {
  switch (name) {
    case 'azure-openai-chat':
      return 'Azure OpenAI';
    case 'openai-chat':
      return 'OpenAI';
    case 'anthropic-chat':
      return 'Anthropic';
    case 'chat-google-generative-ai':
      return 'Google AI';
    default:
      return 'Unknown';
  }
}

export function LLMLocationUsagePane({
  name,
  llmOriginRecord,
}: {
  name: string;
  llmOriginRecord: LLMUsageOriginTypesType;
}) {
  return (
    llmOriginRecord && (
      <div className="bg-white py-8 md:py-12 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            {name === 'AIMIE'
              ? 'QA and Declaration Writer'
              : 'Document Ingestion'}
          </h2>
          {Object.entries(llmOriginRecord)
            .filter(
              ([, llmOriginRecordValue]) =>
                typeof llmOriginRecordValue === 'object' &&
                llmOriginRecordValue !== null,
            )
            .map(([origin, llmUsageRecordValue]) =>
              typeof llmUsageRecordValue === 'object' &&
              llmUsageRecordValue !== null
                ? Object.entries(llmUsageRecordValue).map(
                    ([llmType, llmTypeRecord]) =>
                      convertLLMTypeName(llmType) !== 'Unknown' && (
                        <LLMUsagePane
                          key={`${origin}-${llmType}`}
                          name={convertLLMTypeName(llmType)}
                          llmTypeRecord={llmTypeRecord}
                        />
                      ),
                  )
                : null,
            )}
        </div>
      </div>
    )
  );
}
