'use client';

import BarAdmissionStepper from '@/components/profile/BarAdmissionStepper';
import {
  type BarAdmission,
  type FederalCourtType,
  type JurisdictionsResponse,
} from '@/lib/types';

function createAdmission(): BarAdmission {
  return {
    jurisdictionType: 'State',
    jurisdictionCode: '',
    identifier: '',
  };
}

function humanize(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function resolveJurisdictionName(
  admission: BarAdmission,
  jurisdictions: JurisdictionsResponse | null,
): string {
  const records =
    admission.jurisdictionType === 'State'
      ? jurisdictions?.states
      : admission.jurisdictionType === 'Federal'
        ? jurisdictions?.federal
        : jurisdictions?.tribal;

  return (
    records?.find(
      (jurisdiction) =>
        jurisdiction.countryCode === 'US' &&
        jurisdiction.jurisdictionCode === admission.jurisdictionCode,
    )?.name ?? admission.jurisdictionCode
  );
}

type BarAdmissionsEditorProps = {
  admissions: BarAdmission[];
  isEditable: boolean;
  jurisdictions: JurisdictionsResponse | null;
  referenceDataError: boolean;
  disabled?: boolean;
  onChange: (admissions: BarAdmission[]) => void;
};

export default function BarAdmissionsEditor({
  admissions,
  isEditable,
  jurisdictions,
  referenceDataError,
  disabled = false,
  onChange,
}: BarAdmissionsEditorProps) {
  const updateAdmission = (
    index: number,
    updatedAdmission: BarAdmission,
  ) => {
    onChange(
      admissions.map((admission, admissionIndex) =>
        admissionIndex === index ? updatedAdmission : admission,
      ),
    );
  };

  return (
    <section
      aria-labelledby="bar-admissions-heading"
      className="col-span-full border-t border-gray-900/10 pt-8 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="bar-admissions-heading"
            className="text-base font-semibold text-gray-900 dark:text-white">
            Bar Admissions
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Use the guided steps to select each jurisdiction where you are
            admitted to practice.
          </p>
        </div>
        {isEditable && (
          <button
            type="button"
            onClick={() => onChange([...admissions, createAdmission()])}
            disabled={disabled}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400">
            Add admission
          </button>
        )}
      </div>

      {admissions.length === 0 ? (
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          No bar admissions added.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {admissions.map((admission, index) => (
            <fieldset
              key={index}
              className="rounded-md border border-gray-200 p-4 dark:border-white/10">
              <legend className="sr-only">Bar admission {index + 1}</legend>
              {isEditable ? (
                <>
                  <BarAdmissionStepper
                    admission={admission}
                    admissionIndex={index}
                    jurisdictions={jurisdictions}
                    referenceDataError={referenceDataError}
                    disabled={disabled}
                    onChange={(updatedAdmission) =>
                      updateAdmission(index, updatedAdmission)
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onChange(
                        admissions.filter(
                          (_, admissionIndex) => admissionIndex !== index,
                        ),
                      )
                    }
                    disabled={disabled}
                    className="mt-5 rounded-md px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-950/30">
                    Remove admission
                  </button>
                </>
              ) : (
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">
                      Jurisdiction
                    </dt>
                    <dd className="font-medium text-gray-900 dark:text-white">
                      {admission.jurisdictionType} ·{' '}
                      {resolveJurisdictionName(admission, jurisdictions)}
                    </dd>
                  </div>
                  {admission.jurisdictionType === 'Federal' && (
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">
                        Court type
                      </dt>
                      <dd className="font-medium text-gray-900 dark:text-white">
                        {humanize(
                          admission.courtType as FederalCourtType,
                        )}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">
                      Bar admission ID
                    </dt>
                    <dd className="font-medium text-gray-900 dark:text-white">
                      {admission.identifier}
                    </dd>
                  </div>
                </dl>
              )}
            </fieldset>
          ))}
        </div>
      )}
    </section>
  );
}
