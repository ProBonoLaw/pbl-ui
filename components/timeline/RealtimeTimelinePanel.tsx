'use client';

import TimelineAccordion from '@/components/timeline/TimelineAccordion';
import { FormActions, FormSection } from '@/components/forms/FormSection';
import type { FormEvent } from 'react';

export default function RealtimeTimelinePanel({
  requestText,
  onRequestTextChange,
  includeEvents,
  onIncludeEventsChange,
  includeFacts,
  onIncludeFactsChange,
  isSubmitting,
  isReady,
  hasResults,
  onSubmit,
  onReset,
}: Readonly<{
  requestText: string;
  onRequestTextChange: (value: string) => void;
  includeEvents: boolean;
  onIncludeEventsChange: (value: boolean) => void;
  includeFacts: boolean;
  onIncludeFactsChange: (value: boolean) => void;
  isSubmitting: boolean;
  isReady: boolean;
  hasResults: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
}>) {
  const hasIncludedContent = includeEvents || includeFacts;

  return (
    <TimelineAccordion
      title="Build realtime timeline"
      description="Add instructions and choose the event and fact records to include."
      defaultOpen={!hasResults}
      collapseWhen={hasResults}>
      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
        <FormSection title="Timeline Instructions" description="Describe the timeline you want to build.">
          <div className="col-span-full">
            <label htmlFor="timeline-request" className="text-sm font-semibold">
              Timeline instructions
            </label>
            <textarea
              id="timeline-request"
              value={requestText}
              onChange={(event) => onRequestTextChange(event.target.value)}
              rows={4}
              required
              disabled={isSubmitting}
              className="mt-2 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>
        </FormSection>

        <FormSection title="Included Records" description="Select the records to use in the timeline.">
          <fieldset className="col-span-full">
            <legend className="sr-only">Include</legend>
            <div className="mt-2 flex gap-5 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeEvents}
                  onChange={(event) =>
                    onIncludeEventsChange(event.target.checked)
                  }
                  disabled={isSubmitting}
                />
                Events
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeFacts}
                  onChange={(event) => onIncludeFactsChange(event.target.checked)}
                  disabled={isSubmitting}
                />
                Facts
              </label>
            </div>
          </fieldset>
        </FormSection>

        <FormActions className="justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {!hasIncludedContent ? 'Choose at least one item type.' : ''}
          </span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onReset}
              disabled={isSubmitting}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20">
              Reset
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !hasIncludedContent || !isReady}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300">
              {isSubmitting ? 'Building timeline…' : 'Build realtime timeline'}
            </button>
          </div>
        </FormActions>
      </form>
    </TimelineAccordion>
  );
}
