'use client';

import { useState } from 'react';
import {
  DOCUMENT_ACCESS_ROLE_OPTIONS,
  normalizeDocumentAccessRole,
  type DocumentAccessRole,
} from '@/lib/sharePointAccess';

export const DocumentAccessRoleField = ({
  defaultCanAccessDocuments,
  defaultDocumentAccessRole,
}: {
  defaultCanAccessDocuments?: boolean;
  defaultDocumentAccessRole?: DocumentAccessRole;
}) => {
  const [canAccessDocuments, setCanAccessDocuments] = useState(
    defaultCanAccessDocuments === true,
  );
  const documentAccessRole = normalizeDocumentAccessRole(
    defaultDocumentAccessRole,
  );

  return (
    <div className="flex gap-3 mb-4">
      <div className="flex h-6 shrink-0 items-center">
        <div className="group grid size-4 grid-cols-1">
          <input
            id="can-access-documents"
            name="can-access-documents"
            checked={canAccessDocuments}
            onChange={(event) => setCanAccessDocuments(event.target.checked)}
            type="checkbox"
            aria-describedby="can-access-documents-description"
            className="col-start-1 row-start-1 appearance-none rounded-sm border border-gray-300 bg-white checked:border-indigo-600 checked:bg-indigo-600 indeterminate:border-indigo-600 indeterminate:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:border-gray-300 disabled:bg-gray-100 disabled:checked:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:checked:border-indigo-500 dark:checked:bg-indigo-500 dark:indeterminate:border-indigo-500 dark:indeterminate:bg-indigo-500 dark:focus-visible:outline-indigo-500 dark:disabled:border-white/5 dark:disabled:bg-white/10 dark:disabled:checked:bg-white/10 forced-colors:appearance-auto"
          />
          <svg
            fill="none"
            viewBox="0 0 14 14"
            className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-disabled:stroke-gray-950/25 dark:group-has-disabled:stroke-white/25">
            <path
              d="M3 8L6 11L11 3.5"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-0 group-has-checked:opacity-100"
            />
            <path
              d="M3 7H11"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-0 group-has-indeterminate:opacity-100"
            />
          </svg>
        </div>
      </div>
      <div className="text-sm/6">
        <label
          htmlFor="can-access-documents"
          className="font-medium text-gray-900 dark:text-white">
          Access Documents
        </label>
        <p
          id="can-access-documents-description"
          className="text-gray-500 dark:text-gray-400">
          Allows the user to access documents for this case.
        </p>
        <fieldset className="mt-3" aria-label="Document access role">
          <legend className="sr-only">Document access role</legend>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-4 mb-4">
            {DOCUMENT_ACCESS_ROLE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex max-w-sm gap-2 rounded-md border px-3 py-2 ${canAccessDocuments
                  ? 'border-gray-300 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white'
                  : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-gray-500'
                  }`}>
                <input
                  type="radio"
                  name="document-access-role"
                  value={option.value}
                  defaultChecked={documentAccessRole === option.value}
                  disabled={!canAccessDocuments}
                  className="mt-1 size-4 border-gray-300 text-indigo-600 focus:ring-indigo-600 disabled:text-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:disabled:text-gray-600"
                />
                <span>
                  <span className="block font-medium">{option.label}</span>
                  <span className="block text-gray-500 dark:text-gray-400">
                    {option.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
};
