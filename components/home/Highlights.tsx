'use client';

import HighlightBar from '@/components/HighlightBar';
import { Clock3, FileText, SearchCheck, ShieldCheck } from 'lucide-react';

export default function Highlights() {
  return (
    <section className="w-full py-16 sm:py-32">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
          Highlights of Using ProBono-Law
        </h2>

        <div className="mt-10 flex flex-col gap-12">
          <div className="pr-8 sm:pr-18">
            <HighlightBar
              orientation="left"
              icon={<SearchCheck className="h-6 w-6" aria-hidden="true" />}>
              <span className="font-semibold">
                Our AI answers questions, with sources, based on an analysis of
                your entire dossier
              </span>{' '}
              including but not limited to declarations, reports, financial, and
              emails. Upload once and it will be checked in every query.
            </HighlightBar>
          </div>

          <div className="pl-8 sm:pl-18">
            <HighlightBar
              orientation="right"
              icon={<FileText className="h-6 w-6" aria-hidden="true" />}>
              ProBono-Law can{' '}
              <span className="font-semibold">
                find contradictions, unsubstantiated claims, inconsistencies
              </span>{' '}
              across the entire dossier. We can do this because we analyze
              everything.
            </HighlightBar>
          </div>

          <div className="pr-8 sm:pr-18">
            <HighlightBar
              orientation="left"
              icon={<Clock3 className="h-6 w-6" aria-hidden="true" />}>
              Our AI{' '}
              <span className="font-semibold">advocates for your client</span>.
              We can provide arguments with sources based on your dossier for
              whatever issue you ask about. Likewise, our AI will not make up
              facts just to make an argument stronger.
            </HighlightBar>
          </div>

          <div className="pl-8 sm:pl-18">
            <HighlightBar
              orientation="right"
              icon={<ShieldCheck className="h-6 w-6" aria-hidden="true" />}>
              Our answers can{' '}
              <span className="font-semibold">
                withstand scrutiny by opposing parties
              </span>
              . ProBono-Law provides results under the premise it will be
              criticized.
            </HighlightBar>
          </div>
        </div>
      </div>
    </section>
  );
}
