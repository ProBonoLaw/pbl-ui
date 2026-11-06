'use client';

import { Scale, Sparkles, Users } from 'lucide-react';

const pillars = [
  {
    icon: Scale,
    header: 'What is ProBono Law?',
    description:
      'An AI Dossier Analyst that answers questions, locates facts, and builds arguments personalized to your case.',
  },
  {
    icon: Users,
    header: 'Who ProBono Law is for?',
    description:
      'Attorneys who believe every client deserves individual attention without the associated burden of time and cost.',
  },
  {
    icon: Sparkles,
    header: 'Benefits of ProBono Law',
    description:
      'Sources are often fragmented among pleadings, reports, emails, invoices, etc. We fix that while reducing research hours.',
  },
];

export default function WhoWeAre() {
  return (
    <section className="w-full py-18 sm:py-36">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Who We Are
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            We empower attorneys to deliver personalized representation and
            reduce workload with AI grounded in your case&apos;s unique data.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;

            return (
              <article
                key={pillar.header}
                className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
                <div className="mx-auto inline-flex rounded-2xl bg-indigo-100 p-5 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                  <Icon className="h-12 w-12" aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-gray-900 dark:text-white">
                  {pillar.header}
                </h3>
                <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
                  {pillar.description}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
