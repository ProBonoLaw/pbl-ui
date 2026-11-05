'use client';

import HighlightBar from '@/components/HighlightBar';
import { BrainCircuit, Database, MessageSquareText } from 'lucide-react';
import Image from 'next/image';

export default function HowItWorks() {
  return (
    <section className="w-full py-16 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
          How an AI Dossier Analyst works
        </h2>

        <div className="mt-12 grid grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-10">
          <div className="flex flex-col gap-26">
            <HighlightBar
              orientation="left"
              icon={<Database className="h-6 w-6" aria-hidden="true" />}>
              <span className="font-semibold">
                Upload all records you want analyzed once.
              </span>{' '}
              All uploads are secured and encrypted. Nobody else can see the
              data without <span className="italic">your permission</span>.
            </HighlightBar>

            <HighlightBar
              orientation="left"
              icon={<BrainCircuit className="h-6 w-6" aria-hidden="true" />}>
              The AI Dossier Analyst{' '}
              <span className="font-semibold">
                maps the data for future reference.
              </span>{' '}
              This allows us to search everything every time.
            </HighlightBar>

            <HighlightBar
              orientation="left"
              icon={
                <MessageSquareText className="h-6 w-6" aria-hidden="true" />
              }>
              <span className="font-semibold">
                Ask questions, formulate arguments, draft declarations.
              </span>{' '}
              We use Zero Data Retention (ZDR) so our AI does not save any
              answers.
            </HighlightBar>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <Image
              src="/shared/case-workspace-example.png"
              alt="ProBono-Law case workspace displaying fictional example cases"
              width={1440}
              height={1000}
              className="h-auto w-full rounded-xl object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
