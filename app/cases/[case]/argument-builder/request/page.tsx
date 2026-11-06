'use client';
import { FormActions, FormSection } from '@/components/forms/FormSection';
import { logger } from '@/lib/logger';

import LoadingState from '@/components/LoadingState';
import ModalDialog from '@/components/ModalDialog';
import CasePageTemplate from '@/components/cases/CasePageTemplate';
import { useAuth } from '@/hooks/useAuth';
import { invokeFormSubmit } from '@/lib/textAreaInvokeForm';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import AiOutputNotice from '@/components/AiOutputNotice';

export default function Page({
  params,
}: {
  params: Promise<{ case: string }>;
}) {
  const { case: caseId } = use(params);
  const { fetchWithAuth } = useAuth();
  const redirect = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showSubmittedModal, setShowSubmittedModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    const requestText = formData.get('requestText')?.toString() || null;
    const trimmedRequestText = requestText?.trim() || null;
    if (
      trimmedRequestText === null ||
      trimmedRequestText === '' ||
      !caseId ||
      isSubmitting
    ) {
      return;
    }
    logger.info(
      'Submitting argument-builder request with text:',
      trimmedRequestText,
    );
    setIsSubmitting(true);
    try {
      const response = await fetchWithAuth(
        `/api/accounts/cases/${caseId}/argument-builder/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: crypto.randomUUID(),
            requestText: trimmedRequestText,
          }),
        },
      );

      if (response.ok) {
        setError(null);
        setShowSubmittedModal(true);
        const form = event.target as HTMLFormElement;
        form.reset();
      } else {
        setError('Failed to submit argument builder request.');
      }
    } catch (error) {
      logger.error('Error submitting argument builder request:', error);
      setError(
        'An error occurred while submitting the argument builder request.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {showSubmittedModal && caseId && (
        <ModalDialog
          title="Argument Submitted"
          opened={true}
          submitText="OK"
          cancelText={null}
          onApproved={() => {
            setShowSubmittedModal(false);
            redirect.push(`/cases/${caseId}/argument-builder`);
          }}>
          The argument has been submitted and may take 30 minutes to complete. A
          notification will be sent upon its completion.
        </ModalDialog>
      )}
      {error ? (
        <div
          className="bg-red-100 border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
          role="alert">
          <span className="block sm:inline">{error}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
            onClick={() => setError(null)}>
            <svg
              className="h-5 w-5 text-red-700"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ) : (
        <CasePageTemplate
          title="Argument Builder Request"
          isLoading={!caseId}
          params={params}
          actionNotice={<AiOutputNotice />}>
          {isSubmitting && (
            <LoadingState
              title="Preparing Argument"
              message="Submitting the request."
              className="rounded-md border border-blue-100 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30"
            />
          )}
          <form onSubmit={(event) => handleSubmit(event)} className="space-y-8">
            <FormSection title="Request Details" description="Describe the argument you need.">
              <div className="col-span-full">
              <label htmlFor="requestText" className="block text-sm/6 font-medium text-gray-900 dark:text-white">Instructions</label>
              <textarea
                id="requestText"
                name="requestText"
                rows={6}
                className="mt-2 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 focus:border-indigo-600 focus:outline-indigo-600 sm:text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                placeholder="Enter the details for the argument builder request. Press Enter to submit. Press Shift + Enter for new line."
                required
                disabled={isSubmitting}
                onKeyDown={invokeFormSubmit}
              />
              </div>
            </FormSection>
            <FormActions>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
                {isSubmitting ? 'Preparing...' : 'Submit Request'}
              </button>
            </FormActions>
          </form>
        </CasePageTemplate>
      )}
    </>
  );
}
