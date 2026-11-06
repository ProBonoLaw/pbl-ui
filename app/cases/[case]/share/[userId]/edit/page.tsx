'use client';
import { logger } from '@/lib/logger';
import CasePageTemplate from '@/components/cases/CasePageTemplate';
import { DocumentAccessRoleField } from '@/components/forms/DocumentAccessRoleField';
import { FormActions, FormSection } from '@/components/forms/FormSection';
import { FormCheckbox } from '@/components/forms/FormCheckbox';
import { useAuth } from '@/hooks/useAuth';
import { normalizeDocumentAccessRole } from '@/lib/sharePointAccess';
import { UserAccount, UserAccountSchema } from '@/lib/types';
import { Button } from '@headlessui/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function EditSharePage({
  params,
}: {
  params: Promise<{ case: string; userId: string }>;
}) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<UserAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const { fetchWithAuth } = useAuth();
  useEffect(() => {
    params.then((p) => {
      setCaseId(p.case);
      setUserId(p.userId);
    });
  }, [params]);

  useEffect(() => {
    if (!caseId || !userId) {
      return;
    }

    const ac = new AbortController();
    (async () => {
      try {
        logger.info('Fetching shared users data...');
        const res = await fetchWithAuth(
          `/api/accounts/cases/${caseId}/users/${userId}`,
          {
            method: 'GET',
            cache: 'no-store',
            signal: ac.signal,
          },
        );
        if (res.status === 403) {
          router.replace(`/cases/${caseId}`);
          return;
        }
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json();
        const parsed = UserAccountSchema.safeParse(json);
        if (!parsed.success) {
          logger.error(
            'Invalid user payload returned by share user endpoint:',
            parsed.error,
          );
          setError('Unable to load user details right now. Please try again.');
          return;
        }
        setData(parsed.data);
      } catch (e: unknown) {
        const error = e as Error;
        if (error.name !== 'AbortError') {
          setError(error.message ?? 'Request failed');
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      ac.abort();
    };
  }, [caseId, userId, fetchWithAuth, router]);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId) {
      return;
    }
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const emailAddress = formData.get('emailAddress') as string;
    const canUseQA = formData.get('can-use-qa') === 'on';
    const canGenerateDeclarations =
      formData.get('can-generate-declarations') === 'on';
    const canAccessDocuments = formData.get('can-access-documents') === 'on';
    const documentAccessRole = canAccessDocuments
      ? normalizeDocumentAccessRole(formData.get('document-access-role'))
      : undefined;

    try {
      const res = await fetchWithAuth(
        `/api/accounts/cases/${caseId}/users/${userId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            emailAddress,
            canUseQA,
            canGenerateDeclaration: canGenerateDeclarations,
            canAccessDocuments,
            documentAccessRole,
          }),
        },
      );
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Request failed');
      }
      // On success, redirect back to the share page
      router.push(`/cases/${caseId}/share`);
    } catch (error: unknown) {
      const err = error as Error;
      alert(`Error editing shared user: ${err.message}`);
    }
  };

  const handleDelete = async () => {
    if (!caseId || !userId) {
      return;
    }
    try {
      const res = await fetchWithAuth(
        `/api/accounts/cases/${caseId}/users/${userId}`,
        {
          method: 'DELETE',
        },
      );
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Request failed');
      }
      // On success, redirect back to the share page
      router.push(`/cases/${caseId}/share`);
    } catch (error: unknown) {
      const err = error as Error;
      alert(`Error unlinking shared user: ${err.message}`);
    }
  };

  const primaryEmailAddress = data?.emailAddresses?.[0];

  return (
    <CasePageTemplate
      title="Edit Case Sharing"
      isLoading={loading}
      params={params}>
      {error && <p className="text-red-500">Error: {error}</p>}
      {data && !primaryEmailAddress && (
        <p className="text-red-500">
          Error: No email address found for this user.
        </p>
      )}
      {data && primaryEmailAddress && (
        <form onSubmit={handleRequest} className="w-full">
          <div className="mt-8 space-y-10">
            <FormSection title="Shared User" description="The person who can access this case." fieldsClassName="block">
              <label
                htmlFor="emailAddress"
                className="block text-sm/6 font-medium text-gray-900 dark:text-white">
                Email Address
              </label>
              <div className="mt-2">
                <input
                  type="email"
                  name="emailAddress"
                  id="emailAddress"
                  defaultValue={primaryEmailAddress}
                  readOnly
                  required
                  className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 focus:border-indigo-600 focus:outline-indigo-600 sm:text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
            </FormSection>
            <FormSection title="Permissions" description="Choose what this person can do in this case." fieldsClassName="block">
              <div className="space-y-4">
                <div className="flex gap-3 mb-4">
                  <FormCheckbox
                    id="can-use-qa"
                    label="Access to QA"
                    description="Allows the user to access the question and answer section for this case."
                    defaultValue={data?.casesAccounts?.[0]?.canUseQA}
                  />
                </div>
                <div className="flex gap-3 mb-4">
                  <FormCheckbox
                    id="can-generate-declarations"
                    label="Generate Declarations"
                    description="Allows the user to generate declarations for this case."
                    defaultValue={data?.casesAccounts?.[0]?.canGenerateDeclaration}
                  />
                </div>
                <DocumentAccessRoleField
                  defaultCanAccessDocuments={
                    data?.casesAccounts?.[0]?.canAccessDocuments
                  }
                  defaultDocumentAccessRole={normalizeDocumentAccessRole(
                    data?.casesAccounts?.[0]?.documentAccessRole,
                  )}
                />
              </div>
            </FormSection>
            <FormActions>
              <Button
                type="button"
                onClick={handleDelete}
                className="mr-auto inline-flex items-center justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:bg-red-500 dark:shadow-none dark:hover:bg-red-400 dark:focus-visible:outline-red-500">
                Unshare User
              </Button>
              <Link
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:hover:bg-gray-700 dark:focus-visible:outline-indigo-500"
                href="../../">
                Cancel
              </Link>
              <button
                type="submit"
                className="inline-flex justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500">
                Save
              </button>
            </FormActions>
          </div>
        </form>
      )}
    </CasePageTemplate>
  );
}
