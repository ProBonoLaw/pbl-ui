import type { PrivacyPolicyDocument } from '@/lib/privacyPolicyDocuments';
import DecorativePageBackground from '@/components/DecorativePageBackground';
import { FileCheck2, FileText, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-3xl font-semibold tracking-tight text-gray-950 dark:text-white sm:text-4xl">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mt-8 text-xl font-semibold text-gray-950 dark:text-white">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mt-6 text-lg font-semibold text-gray-950 dark:text-white">
      {children}
    </h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mt-4 text-base leading-7 text-gray-700 dark:text-gray-300">
      {children}
    </p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mt-4 list-disc space-y-2 pl-5 text-base leading-7 text-gray-700 dark:text-gray-300">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mt-4 list-decimal space-y-2 pl-5 text-base leading-7 text-gray-700 dark:text-gray-300">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-gray-950 dark:text-white">
      {children}
    </strong>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      className="font-medium text-indigo-700 underline underline-offset-4 hover:text-indigo-600 dark:text-indigo-300 dark:hover:text-indigo-200">
      {children}
    </a>
  ),
};

export default function PrivacyContent({ document }: { document: PrivacyPolicyDocument }) {
  const hasPolicyMarkdown = document.markdown.trim().length > 0;

  return (
    <main className="relative isolate px-6 py-16 sm:py-24 lg:px-8">
      <DecorativePageBackground />

      <div className="mx-auto max-w-5xl">
        <div className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
            Privacy and Security
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-gray-950 dark:text-white sm:text-5xl">
            ProBono Law privacy policies
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-700 dark:text-gray-300">
            Review ProBono Law&apos;s privacy policy and independent SOC 2 Type
            2 attestation materials for the controls supporting the platform.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-gray-800">
            <FileText
              className="h-6 w-6 text-indigo-600 dark:text-indigo-300"
              aria-hidden="true"
            />
            <h2 className="mt-4 text-base font-semibold text-gray-950 dark:text-white">
              Privacy policy
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
              Covers account, billing, visitor, and support data that ProBono
              Law handles as a controller.
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
              <li>
                Uploaded client and case materials are processed for attorney
                customers under the Terms, DPA, and BAA.
              </li>
              <li>
                We do not sell personal data, share it for targeted ads, or use
                personal data or customer content to train large language models.
              </li>
            </ul>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-gray-800">
            <ShieldCheck
              className="h-6 w-6 text-indigo-600 dark:text-indigo-300"
              aria-hidden="true"
            />
            <h2 className="mt-4 text-base font-semibold text-gray-950 dark:text-white">
              Security controls
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
              Safeguards are designed to protect customer data confidentiality,
              integrity, and availability.
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
              <li>
                Customer data is encrypted in transit and at rest, with logical
                segregation between customers.
              </li>
              <li>
                Personnel access uses multi-factor authentication and
                least-privilege controls.
              </li>
              <li>
                Operations include vulnerability scanning, centralized logging,
                alerting, incident response, change management, and backups.
              </li>
            </ul>
          </div>
          <div className="flex rounded-lg border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-gray-800">
            <div className="flex flex-col">
              <FileCheck2
                className="h-6 w-6 text-indigo-600 dark:text-indigo-300"
                aria-hidden="true"
              />
              <h2 className="mt-4 text-base font-semibold text-gray-950 dark:text-white">
                SOC 2 Type 2
              </h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-gray-600 dark:text-gray-300">
                Independent attestation report available for review.
              </p>
              <Link
                href="/api/privacy/soc-2-type-2-report"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex justify-center self-start rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400">
                View SOC 2 Type 2 report
              </Link>
            </div>
          </div>
        </div>

        <section className="mt-12 rounded-lg border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-gray-800 sm:p-8">
          {hasPolicyMarkdown ? (
            <>
              <div className="border-b border-gray-200 pb-5 dark:border-white/10">
                <h2 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">
                  {document.title}
                </h2>
                {document.effectiveDate ? (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    Effective {document.effectiveDate}
                  </p>
                ) : null}
              </div>
              <div className="mt-6">
                <ReactMarkdown components={markdownComponents}>
                  {document.markdown}
                </ReactMarkdown>
              </div>
            </>
          ) : (
            <div className="text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">
                Privacy Policy
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-700 dark:text-gray-300">
                The privacy policy source file is ready to publish, but it does
                not contain policy text yet.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
