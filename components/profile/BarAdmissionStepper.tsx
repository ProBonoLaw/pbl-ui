'use client';

import SearchableSelect, {
  type SearchableSelectOption,
} from '@/components/profile/SearchableSelect';
import type {
  BarAdmission,
  FederalCourtType,
  JurisdictionsResponse,
} from '@/lib/types';

const INPUT_CLASS_NAME =
  'mt-2 block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:focus:outline-indigo-500';
const COUNTRY_CODE = 'US';

function humanize(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) =>
    left.localeCompare(right),
  );
}

type BarAdmissionStepperProps = {
  admission: BarAdmission;
  admissionIndex: number;
  jurisdictions: JurisdictionsResponse | null;
  referenceDataError: boolean;
  disabled?: boolean;
  onChange: (admission: BarAdmission) => void;
};

export default function BarAdmissionStepper({
  admission,
  admissionIndex,
  jurisdictions,
  referenceDataError,
  disabled = false,
  onChange,
}: BarAdmissionStepperProps) {
  const federalCourtTypes = uniqueSorted(
    (jurisdictions?.federal ?? [])
      .filter((jurisdiction) => jurisdiction.countryCode === COUNTRY_CODE)
      .map((jurisdiction) => jurisdiction.courtType),
  ) as FederalCourtType[];
  const courtType = federalCourtTypes.includes(
    admission.courtType as FederalCourtType,
  )
    ? (admission.courtType as FederalCourtType)
    : (federalCourtTypes[0] ?? 'DistrictCourt');

  const states = (jurisdictions?.states ?? []).filter(
    (jurisdiction) => jurisdiction.countryCode === COUNTRY_CODE,
  );
  const federal = (jurisdictions?.federal ?? []).filter(
    (jurisdiction) =>
      jurisdiction.countryCode === COUNTRY_CODE &&
      jurisdiction.courtType === courtType,
  );
  const tribal = (jurisdictions?.tribal ?? []).filter(
    (jurisdiction) => jurisdiction.countryCode === COUNTRY_CODE,
  );
  const fieldPrefix = `bar-admission-${admissionIndex}`;
  const hasReferenceData = jurisdictions !== null;
  const jurisdictionOptions: SearchableSelectOption[] =
    admission.jurisdictionType === 'State'
      ? states.map((jurisdiction) => ({
          value: jurisdiction.jurisdictionCode,
          label: `${jurisdiction.name} (${jurisdiction.type})`,
        }))
      : admission.jurisdictionType === 'Federal'
        ? federal.map((jurisdiction) => ({
            value: jurisdiction.jurisdictionCode,
            label: jurisdiction.name,
          }))
        : tribal.map((jurisdiction) => ({
            value: jurisdiction.jurisdictionCode,
            label: `${jurisdiction.name}${
              jurisdiction.federallyRecognized ? ' (federally recognized)' : ''
            }`,
          }));

  const setJurisdictionType = (
    jurisdictionType: BarAdmission['jurisdictionType'],
  ) => {
    onChange(
      jurisdictionType === 'Federal'
        ? {
            jurisdictionType,
            jurisdictionCode: '',
            identifier: admission.identifier,
            courtType: 'DistrictCourt',
          }
        : {
            jurisdictionType,
            jurisdictionCode: '',
            identifier: admission.identifier,
          },
    );
  };

  const setJurisdictionCode = (jurisdictionCode: string) => {
    if (admission.jurisdictionType === 'Federal') {
      const selected = federal.find(
        (jurisdiction) => jurisdiction.jurisdictionCode === jurisdictionCode,
      );
      onChange({
        ...admission,
        jurisdictionCode,
        courtType: selected?.courtType ?? courtType,
      });
      return;
    }

    onChange({ ...admission, jurisdictionCode });
  };

  const referenceDataMessage = referenceDataError
    ? 'Jurisdiction reference data could not be loaded. Enter the jurisdiction code manually.'
    : 'Loading jurisdiction reference data…';

  return (
    <div className="space-y-5">
      <ol className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <li className="flex items-center gap-2 text-gray-900 dark:text-white">
          <span className="flex size-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
            1
          </span>
          Choose type
        </li>
        <li className="flex items-center gap-2 text-gray-900 dark:text-white">
          <span className="flex size-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
            2
          </span>
          Select jurisdiction
        </li>
        <li className="flex items-center gap-2 text-gray-900 dark:text-white">
          <span className="flex size-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
            3
          </span>
          Add admission ID
        </li>
      </ol>

      <div>
        <label
          htmlFor={`${fieldPrefix}-type`}
          className="block text-sm font-medium text-gray-900 dark:text-white">
        Jurisdiction type
        </label>
        <SearchableSelect
          ariaLabel="Jurisdiction type"
          disabled={disabled}
          id={`${fieldPrefix}-type`}
          options={[
            { value: 'State', label: 'State' },
            { value: 'Federal', label: 'Federal' },
            { value: 'Tribal', label: 'Tribal' },
          ]}
          placeholder="Search jurisdiction types..."
          value={admission.jurisdictionType}
          onChange={(value) =>
            setJurisdictionType(value as BarAdmission['jurisdictionType'])
          }
        />
      </div>

      {hasReferenceData ? (
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          {admission.jurisdictionType === 'Federal' && (
            <div>
              <label
                htmlFor={`${fieldPrefix}-court-type`}
                className="block text-sm font-medium text-gray-900 dark:text-white">
              Federal court type
              </label>
              <SearchableSelect
                ariaLabel="Federal court type"
                disabled={disabled}
                id={`${fieldPrefix}-court-type`}
                options={federalCourtTypes.map((option) => ({
                  value: option,
                  label: humanize(option),
                }))}
                placeholder="Search federal court types..."
                value={courtType}
                onChange={(value) =>
                  onChange({
                    ...admission,
                    jurisdictionCode: '',
                    courtType: value as FederalCourtType,
                  })
                }
              />
            </div>
          )}

          <div className="sm:col-span-2">
            <label
              htmlFor={`${fieldPrefix}-jurisdiction`}
              className="block text-sm font-medium text-gray-900 dark:text-white">
              {admission.jurisdictionType === 'State'
                ? 'State, territory, or district'
                : admission.jurisdictionType === 'Federal'
                  ? 'Federal jurisdiction'
                  : 'Tribal jurisdiction'}
            </label>
            <SearchableSelect
              ariaLabel="Jurisdiction"
              disabled={disabled}
              emptyMessage="No jurisdictions match your search."
              id={`${fieldPrefix}-jurisdiction`}
              options={jurisdictionOptions}
              placeholder="Search jurisdictions..."
              value={admission.jurisdictionCode}
              onChange={setJurisdictionCode}
            />
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {referenceDataMessage}
          </p>
          {referenceDataError && (
            <label className="mt-4 block text-sm font-medium text-gray-900 dark:text-white">
              Jurisdiction code
              <input
                id={`${fieldPrefix}-jurisdiction-code`}
                type="text"
                value={admission.jurisdictionCode}
                onChange={(event) =>
                  onChange({
                    ...admission,
                    jurisdictionCode: event.target.value,
                  })
                }
                disabled={disabled}
                required
                className={INPUT_CLASS_NAME}
              />
            </label>
          )}
        </div>
      )}

      <label className="block text-sm font-medium text-gray-900 dark:text-white">
        Bar admission ID
        <input
          id={`${fieldPrefix}-identifier`}
          type="text"
          value={admission.identifier}
          onChange={(event) =>
            onChange({ ...admission, identifier: event.target.value })
          }
          disabled={disabled}
          required
          className={INPUT_CLASS_NAME}
        />
      </label>
    </div>
  );
}
