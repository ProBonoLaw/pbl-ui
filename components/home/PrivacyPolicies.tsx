'use client';

import { FileCheck2, FileText, LockKeyhole, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

const policyLinks = [
  {
    title: 'Privacy Policy',
    description:
      'Review how ProBono Law publishes privacy terms for personal information and customer data.',
    href: '/privacy',
    action: 'Open privacy page',
    icon: FileText,
  },
  {
    title: 'SOC 2 Type 2 Report',
    description:
      'View the independent attestation report for security controls supporting the platform.',
    href: '/api/privacy/soc-2-type-2-report',
    action: 'View report',
    icon: FileCheck2,
  },
];

export default function PrivacyPolicies() {
  return (
    <section className="w-full py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
            <ShieldCheck
              className="h-7 w-7 text-indigo-600 dark:text-indigo-300"
              aria-hidden="true"
            />
          </div>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Privacy and security policies
          </h2>
          <p className="mt-4 text-base leading-7 text-gray-600 dark:text-gray-300 sm:text-lg">
            ProBono Law publishes privacy materials and independent security
            attestations so firms can evaluate how sensitive legal data is
            handled.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {policyLinks.map((policyLink) => (
            <article
              key={policyLink.title}
              className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 dark:bg-white/10">
                  <policyLink.icon
                    className="h-5 w-5 text-gray-700 dark:text-gray-200"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="text-lg font-semibold text-gray-950 dark:text-white">
                  {policyLink.title}
                </h3>
              </div>
              <p className="mt-4 flex-1 text-base leading-7 text-gray-600 dark:text-gray-300">
                {policyLink.description}
              </p>
              <Link
                href={policyLink.href}
                target={
                  policyLink.href.endsWith('soc-2-type-2-report')
                    ? '_blank'
                    : undefined
                }
                rel={
                  policyLink.href.endsWith('soc-2-type-2-report')
                    ? 'noopener noreferrer'
                    : undefined
                }
                className="mt-6 inline-flex items-center self-start rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500">
                <LockKeyhole className="mr-2 h-4 w-4" aria-hidden="true" />
                {policyLink.action}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
