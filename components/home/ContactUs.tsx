'use client';

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import { logger } from '@/lib/logger';
import { FormActions, FormSection } from '@/components/forms/FormSection';
import { useState } from 'react';

export default function ContactUs() {
  const [isBetaTesterFormOpen, setIsBetaTesterFormOpen] = useState(false);
  const [betaTesterFirstName, setBetaTesterFirstName] = useState('');
  const [betaTesterLastName, setBetaTesterLastName] = useState('');
  const [betaTesterEmail, setBetaTesterEmail] = useState('');
  const [betaTesterConsent, setBetaTesterConsent] = useState(false);
  const [isSubmittingBetaTester, setIsSubmittingBetaTester] = useState(false);
  const [betaTesterError, setBetaTesterError] = useState<string | null>(null);
  const [betaTesterSuccess, setBetaTesterSuccess] = useState<string | null>(
    null,
  );

  const [isNewsletterFormOpen, setIsNewsletterFormOpen] = useState(false);
  const [newsletterFirstName, setNewsletterFirstName] = useState('');
  const [newsletterLastName, setNewsletterLastName] = useState('');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [isSubmittingNewsletter, setIsSubmittingNewsletter] = useState(false);
  const [newsletterError, setNewsletterError] = useState<string | null>(null);
  const [newsletterSuccess, setNewsletterSuccess] = useState<string | null>(
    null,
  );

  const canSubmitBetaTester =
    betaTesterConsent &&
    betaTesterFirstName.trim().length > 0 &&
    betaTesterLastName.trim().length > 0 &&
    betaTesterEmail.trim().length > 0;

  const canSubmitNewsletter =
    newsletterConsent &&
    newsletterFirstName.trim().length > 0 &&
    newsletterLastName.trim().length > 0 &&
    newsletterEmail.trim().length > 0;

  function resetBetaTesterForm() {
    setBetaTesterFirstName('');
    setBetaTesterLastName('');
    setBetaTesterEmail('');
    setBetaTesterConsent(false);
  }

  function openBetaTesterForm() {
    setBetaTesterError(null);
    setBetaTesterSuccess(null);
    setIsBetaTesterFormOpen(true);
  }

  function closeBetaTesterForm() {
    if (isSubmittingBetaTester) {
      return;
    }
    setIsBetaTesterFormOpen(false);
  }

  async function submitBetaTester(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmitBetaTester || isSubmittingBetaTester) {
      return;
    }

    setIsSubmittingBetaTester(true);
    setBetaTesterError(null);
    setBetaTesterSuccess(null);

    try {
      const response = await fetch('/api/beta-tester', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: betaTesterFirstName.trim(),
          lastName: betaTesterLastName.trim(),
          email: betaTesterEmail.trim(),
          consent: betaTesterConsent,
        }),
      });

      if (!response.ok) {
        const body =
          ((await response.json().catch(() => null)) as { error?: string }) ??
          {};
        throw new Error(body.error || `Request failed with ${response.status}`);
      }

      resetBetaTesterForm();
      setIsBetaTesterFormOpen(false);
      setBetaTesterSuccess('Thanks, you are signed up to be a beta tester.');
    } catch (error) {
      logger.error('Failed to submit beta tester signup:', error);
      setBetaTesterError('Failed to sign up. Please try again.');
    } finally {
      setIsSubmittingBetaTester(false);
    }
  }

  function resetNewsletterForm() {
    setNewsletterFirstName('');
    setNewsletterLastName('');
    setNewsletterEmail('');
    setNewsletterConsent(false);
  }

  function openNewsletterForm() {
    setNewsletterError(null);
    setNewsletterSuccess(null);
    setIsNewsletterFormOpen(true);
  }

  function closeNewsletterForm() {
    if (isSubmittingNewsletter) {
      return;
    }
    setIsNewsletterFormOpen(false);
  }

  async function submitNewsletter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmitNewsletter || isSubmittingNewsletter) {
      return;
    }

    setIsSubmittingNewsletter(true);
    setNewsletterError(null);
    setNewsletterSuccess(null);

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: newsletterFirstName.trim(),
          lastName: newsletterLastName.trim(),
          email: newsletterEmail.trim(),
          consent: newsletterConsent,
        }),
      });

      if (!response.ok) {
        const body =
          ((await response.json().catch(() => null)) as { error?: string }) ??
          {};
        throw new Error(body.error || `Request failed with ${response.status}`);
      }

      resetNewsletterForm();
      setIsNewsletterFormOpen(false);
      setNewsletterSuccess('Thanks, you are signed up for our newsletter.');
    } catch (error) {
      logger.error('Failed to submit newsletter signup:', error);
      setNewsletterError('Failed to sign up. Please try again.');
    } finally {
      setIsSubmittingNewsletter(false);
    }
  }

  return (
    <>
      <section className="w-full py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-6 text-center lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Connect with ProBonoLaw
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-gray-600 dark:text-gray-300 sm:text-lg">
            Explore the project and follow development on GitHub.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 py-4">
            <a
              href="https://github.com/ProBonoLaw"
              className="inline-flex items-center rounded-md border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
              Visit ProBonoLaw on GitHub
            </a>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-6 py-16 text-center md:py-32 lg:px-8">
          <h3 className="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">
            Full product release by Fall of 2026!
          </h3>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={openBetaTesterForm}
              className="inline-flex items-center rounded-md bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500">
              Click here to be a Beta Tester
            </button>
            <button
              type="button"
              onClick={openNewsletterForm}
              className="inline-flex items-center rounded-md bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500">
              Sign up for newsletter
            </button>
          </div>
          {betaTesterSuccess ? (
            <p className="mt-4 text-sm font-medium text-green-700 dark:text-green-400">
              {betaTesterSuccess}
            </p>
          ) : null}
          {newsletterSuccess ? (
            <p className="mt-4 text-sm font-medium text-green-700 dark:text-green-400">
              {newsletterSuccess}
            </p>
          ) : null}
        </div>
      </section>
      {isBetaTesterFormOpen ? (
        <Dialog
          open={isBetaTesterFormOpen}
          onClose={closeBetaTesterForm}
          className="fixed inset-0 z-50">
          <DialogBackdrop className="fixed inset-0 bg-black/40" />
          <div className="fixed inset-0 flex items-center justify-center px-4 py-6">
            <DialogPanel className="max-h-[calc(100vh-3rem)] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800 dark:outline dark:-outline-offset-1 dark:outline-white/10">
              <DialogTitle
                as="h4"
                className="text-lg font-semibold text-gray-900 dark:text-white">
                Beta Tester Sign Up
              </DialogTitle>
              <form onSubmit={submitBetaTester} className="mt-6 space-y-8">
                <FormSection title="Contact Information" description="Your details for the beta testing program.">
                  <div className="sm:col-span-3">
                    <label
                      htmlFor="beta-tester-first-name"
                      className="mb-1 block text-sm font-medium text-gray-900 dark:text-white">
                      First Name
                    </label>
                    <input
                      id="beta-tester-first-name"
                      type="text"
                      value={betaTesterFirstName}
                      onChange={(event) => setBetaTesterFirstName(event.target.value)}
                      required
                      data-autofocus
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label
                      htmlFor="beta-tester-last-name"
                      className="mb-1 block text-sm font-medium text-gray-900 dark:text-white">
                      Last Name
                    </label>
                    <input
                      id="beta-tester-last-name"
                      type="text"
                      value={betaTesterLastName}
                      onChange={(event) => setBetaTesterLastName(event.target.value)}
                      required
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div className="col-span-full">
                    <label
                      htmlFor="beta-tester-email"
                      className="mb-1 block text-sm font-medium text-gray-900 dark:text-white">
                      Email Address
                    </label>
                    <input
                      id="beta-tester-email"
                      type="email"
                      value={betaTesterEmail}
                      onChange={(event) => setBetaTesterEmail(event.target.value)}
                      required
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </FormSection>
                <FormSection title="Consent" description="Confirm that you want to sign up.">
                  <label className="col-span-full flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={betaTesterConsent}
                      onChange={(event) => setBetaTesterConsent(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600"
                    />
                    <span>
                      By selecting this checkmark, you are signing up to be a Pro
                      Bono Law beta tester.
                    </span>
                  </label>
                </FormSection>
                <FormActions>
                  <button
                    type="button"
                    onClick={closeBetaTesterForm}
                    disabled={isSubmittingBetaTester}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmitBetaTester || isSubmittingBetaTester}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition enabled:hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
                    {isSubmittingBetaTester ? 'Submitting...' : 'Submit'}
                  </button>
                </FormActions>
                {betaTesterError ? (
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">
                    {betaTesterError}
                  </p>
                ) : null}
              </form>
            </DialogPanel>
          </div>
        </Dialog>
      ) : null}
      {isNewsletterFormOpen ? (
        <Dialog
          open={isNewsletterFormOpen}
          onClose={closeNewsletterForm}
          className="fixed inset-0 z-50">
          <DialogBackdrop className="fixed inset-0 bg-black/40" />
          <div className="fixed inset-0 flex items-center justify-center px-4 py-6">
            <DialogPanel className="max-h-[calc(100vh-3rem)] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800 dark:outline dark:-outline-offset-1 dark:outline-white/10">
              <DialogTitle
                as="h4"
                className="text-lg font-semibold text-gray-900 dark:text-white">
                Newsletter Sign Up
              </DialogTitle>
              <form onSubmit={submitNewsletter} className="mt-6 space-y-8">
                <FormSection title="Contact Information" description="Your details for newsletter updates.">
                  <div className="sm:col-span-3">
                    <label
                      htmlFor="newsletter-first-name"
                      className="mb-1 block text-sm font-medium text-gray-900 dark:text-white">
                      First Name
                    </label>
                    <input
                      id="newsletter-first-name"
                      type="text"
                      value={newsletterFirstName}
                      onChange={(event) => setNewsletterFirstName(event.target.value)}
                      required
                      data-autofocus
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label
                      htmlFor="newsletter-last-name"
                      className="mb-1 block text-sm font-medium text-gray-900 dark:text-white">
                      Last Name
                    </label>
                    <input
                      id="newsletter-last-name"
                      type="text"
                      value={newsletterLastName}
                      onChange={(event) => setNewsletterLastName(event.target.value)}
                      required
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div className="col-span-full">
                    <label
                      htmlFor="newsletter-email"
                      className="mb-1 block text-sm font-medium text-gray-900 dark:text-white">
                      Email Address
                    </label>
                    <input
                      id="newsletter-email"
                      type="email"
                      value={newsletterEmail}
                      onChange={(event) => setNewsletterEmail(event.target.value)}
                      required
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </FormSection>
                <FormSection title="Consent" description="Confirm that you want to sign up.">
                  <label className="col-span-full flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={newsletterConsent}
                      onChange={(event) => setNewsletterConsent(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600"
                    />
                    <span>
                      By selecting this checkmark, you are signing up for Pro Bono
                      Law newsletter.
                    </span>
                  </label>
                </FormSection>
                <FormActions>
                  <button
                    type="button"
                    onClick={closeNewsletterForm}
                    disabled={isSubmittingNewsletter}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmitNewsletter || isSubmittingNewsletter}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition enabled:hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
                    {isSubmittingNewsletter ? 'Submitting...' : 'Submit'}
                  </button>
                </FormActions>
                {newsletterError ? (
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">
                    {newsletterError}
                  </p>
                ) : null}
              </form>
            </DialogPanel>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
