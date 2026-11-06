'use client';

import { Check, X } from 'lucide-react';

type CapabilityStatus = {
  label: string;
  available: boolean;
};

type ComparisonColumn = {
  title: string;
  items: CapabilityStatus[];
};

const columns: ComparisonColumn[] = [
  {
    title: 'Case Management System',
    items: [
      { label: 'Stores client records.', available: true },
      { label: 'Offers administrative tasks.', available: true },
      {
        label: 'Does not answer questions based on your case’s dossier.',
        available: false,
      },
      { label: 'Does not create arguments for your client.', available: false },
    ],
  },
  {
    title: 'Document Intelligence',
    items: [
      {
        label: 'Answers questions based on uploaded document.',
        available: true,
      },
      { label: 'Limited in number of records.', available: false },
      { label: 'Limited in record size.', available: false },
      { label: 'Does not use every record available.', available: false },
      { label: 'Does not create arguments for your client.', available: false },
    ],
  },
  {
    title: 'AI Legal Research Tools',
    items: [
      { label: 'Answers questions based on legal databases.', available: true },
      {
        label: 'Provides citation verification.',
        available: true,
      },
      {
        label: 'Does not answer questions based on your case’s dossier.',
        available: false,
      },
      {
        label: 'Does not create arguments for your client.',
        available: false,
      },
    ],
  },
];

export default function WhatsDifferent() {
  return (
    <section className="w-full py-16 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
          What makes an AI Dossier Analyst different?
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {columns.map((column) => (
            <article
              key={column.title}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {column.title}
              </h3>
              <ul className="mt-5 space-y-3">
                {column.items.map((item) => (
                  <li key={item.label} className="flex items-start gap-3">
                    <span
                      className={
                        item.available
                          ? 'mt-0.5 inline-flex rounded-md bg-emerald-100 p-1 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'mt-0.5 inline-flex rounded-md bg-rose-100 p-1 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                      }>
                      {item.available ? (
                        <Check className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <X className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                    <span className="text-sm leading-6 text-gray-700 dark:text-gray-200">
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-5xl text-center text-lg font-medium text-gray-900 dark:text-white">
          <span className="font-semibold">AI Dossier Analyst</span> does what{' '}
          <span className="italics">CMS</span>,{' '}
          <span className="italics">Document Intelligence</span>, and{' '}
          <span className="italics">AI Legal Research Tools</span>{' '}
          <span className="font-semibold">do not</span>. It answers questions
          based on <span className="font-semibold">your case&apos;s</span>
          Research Tools <span className="font-semibold">do not</span>. It
          answers questions based on{' '}
          <span className="font-semibold">your case&apos;s</span> entire
          dossier, uses{' '}
          <span className="font-semibold">every record available</span>, and
          creates arguments for{' '}
          <span className="font-semibold">your client</span>.
        </p>
      </div>
    </section>
  );
}
