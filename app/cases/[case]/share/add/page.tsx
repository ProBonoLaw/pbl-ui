"use client";
import { DocumentAccessRoleField } from "@/components/forms/DocumentAccessRoleField";
import { FormActions, FormSection } from "@/components/forms/FormSection";
import { FormCheckbox } from "@/components/forms/FormCheckbox";
import CasePageTemplate from "@/components/cases/CasePageTemplate";
import { useAuth } from "@/hooks/useAuth";
import { normalizeDocumentAccessRole } from "@/lib/sharePointAccess";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useEffect, useState } from "react";

export default function AddPage({ params }: { params: Promise<{ case: string }> }) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const router = useRouter();
  const { fetchWithAuth } = useAuth();
  useEffect(() => {
    params.then(p => setCaseId(p.case));
  }, [params]);

  useEffect(() => {
    if (!caseId) {
      return;
    }
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetchWithAuth(`/api/accounts/cases/${caseId}/users`, {
          method: "GET",
          cache: "no-store",
          signal: ac.signal,
        });
        if (res.status === 403) {
          router.replace(`/cases/${caseId}`);
        }
      } catch {
        // ignore access preflight failures; form submit is still server-guarded
      }
    })();

    return () => {
      ac.abort();
    };
  }, [caseId, fetchWithAuth, router]);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId) {
      return;
    }
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const emailAddress = formData.get("emailAddress") as string;
    const canUseQA = formData.get("can-use-qa") === "on";
    const canGenerateDeclarations = formData.get("can-generate-declarations") === "on";
    const canAccessDocuments = formData.get("can-access-documents") === "on";
    const documentAccessRole = canAccessDocuments
      ? normalizeDocumentAccessRole(formData.get("document-access-role"))
      : undefined;

    try {
      const res = await fetchWithAuth(`/api/accounts/cases/${caseId}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          guests: [
            {
              emailAddress,
              canUseQA,
              canGenerateDeclaration: canGenerateDeclarations,
              canAccessDocuments,
              documentAccessRole,
            },
          ],
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Request failed");
      }
      // On success, redirect back to the share page
      router.push(`/cases/${caseId}/share`);
    } catch (error: unknown) {
      const err = error as Error;
      alert(`Error adding shared user: ${err.message}`);
    }
  }

  return (<CasePageTemplate title="Add Case Sharing" params={params}>
    <form onSubmit={handleRequest} className="w-full">
      <div className="mt-8 space-y-10">
        <FormSection title="Shared User" description="The person who can access this case." fieldsClassName="block">
          <label htmlFor="emailAddress" className="block text-sm/6 font-medium text-gray-900 dark:text-white">
            Email Address
          </label>
          <div className="mt-2">
            <input
              type="email"
              name="emailAddress"
              id="emailAddress"
              required
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 focus:border-indigo-600 focus:outline-indigo-600 sm:text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>
        </FormSection>
        <FormSection title="Permissions" description="Choose what this person can do in this case." fieldsClassName="block">
          <div className="space-y-4">
            <div className="flex gap-3 py-4">
              <FormCheckbox id="can-use-qa" label="Access to QA" description="Allows the user to access the question and answer section for this case." />
            </div>
            <div className="flex gap-3 py-4">
              <FormCheckbox id="can-generate-declarations" label="Generate Declarations" description="Allows the user to generate declarations for this case." />
            </div>
            <DocumentAccessRoleField />
          </div>
        </FormSection>
        <FormActions>
          <Link className="text-sm/6 font-semibold text-gray-900 dark:text-white" href="..">
            Cancel
          </Link>
          <button
            type="submit"
            className="inline-flex justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500"
          >
            Add Shared User
          </button>
        </FormActions>
      </div>
    </form>
  </CasePageTemplate>)
}
