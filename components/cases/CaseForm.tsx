import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';
import ModalDialog from '@/components/ModalDialog';
import {
  BillingCode,
  CaseMap,
  GraphUser,
  JurisdictionsResponseSchema,
  OriginalCaseDetailsSchema,
  type StateJurisdiction,
} from '@/lib/types';
import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CaseTextField } from './CaseTextField';
import SearchableSelect, { type SearchableSelectOption } from '@/components/profile/SearchableSelect';
import { FormActions, FormSection } from '@/components/forms/FormSection';

const DEFAULT_CASE_STATE_CODE = 'OK';
const ENABLED_CASE_STATE_CODES = new Set(['OK', 'WA']);

const filingRoleOptions = [
  { value: 'Plaintiff', label: 'Plaintiff' },
  { value: 'Defendant', label: 'Defendant' },
  { value: 'Petitioner', label: 'Petitioner' },
  { value: 'Respondent', label: 'Respondent' },
];

const complementaryFilingRoles: Record<string, string> = {
  Plaintiff: 'Defendant',
  Defendant: 'Plaintiff',
  Defendent: 'Plaintiff',
  Petitioner: 'Respondent',
  Respondent: 'Petitioner',
};

const NEW_CASE_ACCOUNT_ID = '';

const formFieldBySchemaPath: Record<string, string> = {
  caseNumber: 'caseNumber',
  description: 'description',
  state: 'state',
  county: 'county',
  filingRole: 'filingRole',
  'personInformation.firstName': 'firstName',
  'personInformation.lastName': 'lastName',
  'personInformation.organization': 'organization',
  'personInformation.emailAddress': 'emailAddress',
  'personInformation.phoneNumber': 'phoneNumber',
  'currentAttorney.firstName': 'currentAttorneyFirstName',
  'currentAttorney.lastName': 'currentAttorneyLastName',
  'currentAttorney.firmName': 'currentAttorneyFirmName',
  'currentAttorney.emailAddress': 'currentAttorneyEmailAddress',
  'currentAttorney.phoneNumber': 'currentAttorneyPhoneNumber',
  'opposition.firstName': 'oppositionFirstName',
  'opposition.lastName': 'oppositionLastName',
  'opposition.organization': 'oppositionOrganization',
  'opposition.filingRole': 'oppositionFilingRole',
  'opposition.emailAddress': 'oppositionEmailAddress',
  'opposition.phoneNumber': 'oppositionPhoneNumber',
  'opposition.currentAttorney.firstName': 'oppositionAttorneyFirstName',
  'opposition.currentAttorney.lastName': 'oppositionAttorneyLastName',
  'opposition.currentAttorney.firmName': 'oppositionAttorneyFirmName',
  'opposition.currentAttorney.emailAddress': 'oppositionAttorneyEmailAddress',
  'opposition.currentAttorney.phoneNumber': 'oppositionAttorneyPhoneNumber',
};

function getIssueMessage(schemaPath: string, issue: { code: string; message: string }) {
  if (
    issue.code === 'invalid_union' &&
    schemaPath.endsWith('emailAddress')
  ) {
    return 'Enter a valid email address or leave this field blank.';
  }
  return issue.message;
}

function CaseSearchableField({
  label,
  ariaLabel = label,
  name,
  options,
  placeholder,
  value,
  onChange,
  disabled,
}: {
  label: string;
  ariaLabel?: string;
  name: string;
  options: SearchableSelectOption[];
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <>
      <label
        htmlFor={name}
        className="block text-sm/6 font-medium text-gray-900 dark:text-white">
        {label}
      </label>
      <SearchableSelect
        ariaLabel={ariaLabel}
        id={name}
        options={options}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
      <input type="hidden" name={name} value={value} readOnly />
    </>
  );
}

export const CaseForm = ({
  defaultValue,
  onSubmit,
  onCancel,
  isEditable,
  isSubmitting = false,
  showBillingCode = false,
  actionsContainer,
}: {
  defaultValue?: CaseMap;
  onSubmit: (
    data: CaseMap,
    isAttorney: boolean,
  ) => boolean | void | Promise<boolean | void>;
  onCancel?: () => void;
  isEditable: boolean;
  isSubmitting?: boolean;
  showBillingCode?: boolean;
  actionsContainer?: HTMLElement | null;
}) => {
  const { getProfile } = useAuth();
  const [profile, setProfile] = useState<GraphUser | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const formId = useId();
  const [isPrestine, setIsPrestine] = useState(true);
  const [formValidationError, setFormValidationError] = useState<string | null>(
    null,
  );
  const [stateJurisdictions, setStateJurisdictions] =
    useState<StateJurisdiction[] | null>(null);
  const [stateLoadError, setStateLoadError] = useState(false);
  const [stateLoadAttempt, setStateLoadAttempt] = useState(0);
  const [selectedStateCode, setSelectedStateCode] = useState(
    defaultValue?.record?.state || DEFAULT_CASE_STATE_CODE,
  );
  const [selectedFilingRole, setSelectedFilingRole] = useState(
    defaultValue?.record?.filingRole || '',
  );
  const [selectedOppositionFilingRole, setSelectedOppositionFilingRole] =
    useState(defaultValue?.record?.opposition?.filingRole || '');
  const [selectedBillingCode, setSelectedBillingCode] = useState(
    defaultValue?.billingCode || '',
  );
  const [selectResetKey, setSelectResetKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStateLoadError(false);

    fetch('/api/jurisdictions', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load states: ${response.status}`);
        }
        const jurisdictions = JurisdictionsResponseSchema.parse(
          await response.json(),
        );
        const states = jurisdictions.states.filter(
          (jurisdiction) => jurisdiction.countryCode === 'US',
        );
        if (!states.some((state) => state.jurisdictionCode === DEFAULT_CASE_STATE_CODE)) {
          throw new Error('The default case state is missing from jurisdiction data.');
        }
        return states;
      })
      .then((states) => {
        if (!controller.signal.aborted) {
          setStateJurisdictions(states);
          setStateLoadError(false);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          logger.error('Failed to load case states:', error);
          setStateLoadError(true);
        }
      });

    return () => controller.abort();
  }, [stateLoadAttempt]);

  const clearFieldValidationErrors = (form: HTMLFormElement) => {
    const fields = form.elements;
    for (let i = 0; i < fields.length; i += 1) {
      const field = fields.item(i);
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement ||
        field instanceof HTMLTextAreaElement
      ) {
        field.setCustomValidity('');
      }
    }
  };

  const resolvedAccountId =
    defaultValue?.record?.accountId ||
    defaultValue?.accountId ||
    NEW_CASE_ACCOUNT_ID;
  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    const rawBillingCode = formData.get('billingCode');
    const billingCode = showBillingCode
      ? typeof rawBillingCode === 'string' &&
        (rawBillingCode === 'F' ||
          rawBillingCode === 'S1' ||
          rawBillingCode === 'G1' ||
          rawBillingCode === 'D')
        ? (rawBillingCode as BillingCode)
        : undefined
      : defaultValue?.billingCode;
    if (showBillingCode && !billingCode) {
      setFormValidationError('Select a billing code.');
      return;
    }
    const updatedData: CaseMap = {
      accountId: resolvedAccountId,
      caseNumber: formData.get('caseNumber') as string,
      billingCode,
      agreedToCaseTerms: defaultValue?.agreedToCaseTerms === true,
      isGuest: defaultValue?.isGuest,
      canUseQA: defaultValue?.canUseQA,
      canGenerateDeclaration: defaultValue?.canGenerateDeclaration,
      canAccessDocuments: defaultValue?.canAccessDocuments,
      requestDate: defaultValue?.requestDate,
      record: {
        description: formData.get('description') as string,
        state: formData.get('state') as string,
        county: formData.get('county') as string,
        filingRole: formData.get('filingRole') as string,
        id: defaultValue?.record?.id || undefined,
        accountId: resolvedAccountId || undefined,
        type: 'ACCOUNT_DETAILS',
        caseNumber: formData.get('caseNumber') as string,
        personInformation: {
          firstName: formData.get('firstName') as string,
          lastName: formData.get('lastName') as string,
          emailAddress: formData.get('emailAddress') as string,
          phoneNumber: formData.get('phoneNumber') as string,
          organization: formData.get('organization') as string,
        },
        currentAttorney: {
          firstName: formData.get('currentAttorneyFirstName') as string,
          lastName: formData.get('currentAttorneyLastName') as string,
          firmName: formData.get('currentAttorneyFirmName') as string,
          phoneNumber: formData.get('currentAttorneyPhoneNumber') as string,
          emailAddress: formData.get('currentAttorneyEmailAddress') as string,
          isCurrent: true,
        },
        opposition: {
          firstName: formData.get('oppositionFirstName') as string,
          lastName: formData.get('oppositionLastName') as string,
          organization: formData.get('oppositionOrganization') as string,
          filingRole: formData.get('oppositionFilingRole') as string,
          emailAddress: formData.get('oppositionEmailAddress') as string,
          phoneNumber: formData.get('oppositionPhoneNumber') as string,
          currentAttorney: {
            firstName: formData.get('oppositionAttorneyFirstName') as string,
            lastName: formData.get('oppositionAttorneyLastName') as string,
            firmName: formData.get('oppositionAttorneyFirmName') as string,
            emailAddress: formData.get(
              'oppositionAttorneyEmailAddress',
            ) as string,
            phoneNumber: formData.get(
              'oppositionAttorneyPhoneNumber',
            ) as string,
            isCurrent: true,
          },
        },
      },
    };
    const form = formRef.current;
    if (form) {
      clearFieldValidationErrors(form);
    }
    setFormValidationError(null);
    const parsedRecord = OriginalCaseDetailsSchema.safeParse(updatedData.record);
    if (!parsedRecord.success) {
      const firstErrorByField = new Map<string, string>();
      let fallbackErrorMessage = 'Please correct the highlighted fields.';
      parsedRecord.error.issues.forEach((issue) => {
        const schemaPath = issue.path.join('.');
        const fieldName = formFieldBySchemaPath[schemaPath];
        const message = getIssueMessage(schemaPath, issue);
        fallbackErrorMessage = message || fallbackErrorMessage;
        if (!fieldName || firstErrorByField.has(fieldName)) {
          return;
        }
        firstErrorByField.set(fieldName, message);
      });
      if (form && firstErrorByField.size > 0) {
        firstErrorByField.forEach((message, fieldName) => {
          const field = form.elements.namedItem(fieldName);
          if (
            field instanceof HTMLInputElement ||
            field instanceof HTMLSelectElement ||
            field instanceof HTMLTextAreaElement
          ) {
            field.setCustomValidity(message);
          }
        });
        form.reportValidity();
        setFormValidationError(fallbackErrorMessage);
        return;
      }
      setFormValidationError(fallbackErrorMessage);
      return;
    }
    const saved = await onSubmit(updatedData, profile?.isAttorney || false);
    if (saved !== false) {
      setIsPrestine(true);
    }
  };

  useEffect(() => {
    if (getProfile) {
      getProfile().then((profile) => {
        setProfile(profile);
      });
    }
  }, [getProfile]);

  const defaultPersonInformation = (() => {
    if (
      (!defaultValue || !defaultValue?.record?.personInformation) &&
      !profile?.isAttorney
    ) {
      return {
        firstName: profile?.givenName || '',
        lastName: profile?.surname || '',
        organization: String(profile?.companyName || ''),
        emailAddress: profile?.mail || '',
        phoneNumber: String(profile?.mobilePhone || ''),
      };
    }
    return (
      defaultValue?.record?.personInformation || {
        firstName: '',
        lastName: '',
        organization: '',
        emailAddress: '',
        phoneNumber: '',
      }
    );
  })();

  const defaultCurrentAttorney = (() => {
    if (
      (!defaultValue || !defaultValue?.record?.currentAttorney) &&
      profile?.isAttorney
    ) {
      return {
        firstName: profile?.givenName || '',
        lastName: profile?.surname || '',
        firmName: String(profile?.companyName || ''),
        emailAddress: profile?.mail || '',
        phoneNumber: String(profile?.mobilePhone || ''),
        isCurrent: true,
      };
    }
    return (
      defaultValue?.record?.currentAttorney || {
        firstName: '',
        lastName: '',
        firmName: '',
        emailAddress: '',
        phoneNumber: '',
        isCurrent: true,
      }
    );
  })();

  const defaultCaseDetails = (() => {
    if (!defaultValue) {
      return {
        accountId: resolvedAccountId,
        caseNumber: '',
        description: '',
        state: DEFAULT_CASE_STATE_CODE,
        county: '',
        filingRole: '',
        id: '',
      };
    }
    return {
      accountId: defaultValue.accountId || '',
      caseNumber: defaultValue.caseNumber || '',
      description: defaultValue.record?.description || '',
      state: defaultValue.record?.state || '',
      county: defaultValue.record?.county || '',
      filingRole: defaultValue.record?.filingRole || '',
      id: defaultValue.record?.id || '',
    };
  })();

  const existingStateCode = defaultValue?.record?.state || '';
  const stateOptions = stateJurisdictions
    ? stateJurisdictions.map((state) => ({
        value: state.jurisdictionCode,
        label: state.name,
        disabled:
          !ENABLED_CASE_STATE_CODES.has(state.jurisdictionCode) &&
          state.jurisdictionCode !== existingStateCode,
      }))
    : [];
  if (
    existingStateCode &&
    !stateOptions.some((option) => option.value === existingStateCode)
  ) {
    stateOptions.unshift({
      value: existingStateCode,
      label: existingStateCode,
      disabled: false,
    });
  }
  if (stateOptions.length === 0) {
    stateOptions.push({
      value: '',
      label: stateLoadError ? 'States unavailable' : 'Loading states...',
      disabled: true,
    });
  }

  const defaultBillingCode = defaultValue?.billingCode || '';

  const billingCodeOptions = (() => {
    const options = [
      { value: 'S1', label: 'Silver' },
      { value: 'G1', label: 'Gold' },
      { value: 'D', label: 'Demo' },
    ];
    if (profile?.isAttorney) {
      options.push({ value: 'F', label: 'ProBono Cases' });
    }
    return options;
  })();

  const defaultOpposition = (() => {
    if (!defaultValue || !defaultValue?.record?.opposition) {
      return {
        firstName: '',
        lastName: '',
        firmName: '',
        emailAddress: '',
        phoneNumber: '',
        organization: '',
        filingRole: '',
        isCurrent: false,
      };
    }
    return (
      defaultValue?.record?.opposition || {
        firstName: '',
        lastName: '',
        firmName: '',
        emailAddress: '',
        phoneNumber: '',
        organization: '',
        filingRole: '',
        isCurrent: false,
      }
    );
  })();

  const defaultOppositionAttorney = (() => {
    if (!defaultValue || !defaultValue?.record?.opposition?.currentAttorney) {
      return {
        firstName: '',
        lastName: '',
        firmName: '',
        emailAddress: '',
        phoneNumber: '',
        isCurrent: false,
      };
    }
    return (
      defaultValue?.record?.opposition?.currentAttorney || {
        firstName: '',
        lastName: '',
        firmName: '',
        emailAddress: '',
        phoneNumber: '',
        isCurrent: false,
      }
    );
  })();

  function clearSelectValidation(name: string) {
    const field = formRef.current?.elements.namedItem(name);
    if (field instanceof HTMLInputElement) {
      field.setCustomValidity('');
    }
    setFormValidationError(null);
    setIsPrestine(false);
  }

  function resetForm() {
    const form = formRef.current;
    if (form) {
      form.reset();
      clearFieldValidationErrors(form);
    }
    setSelectedStateCode(defaultCaseDetails.state);
    setSelectedFilingRole(defaultCaseDetails.filingRole);
    setSelectedOppositionFilingRole(defaultOpposition.filingRole || '');
    setSelectedBillingCode(defaultBillingCode);
    setSelectResetKey((key) => key + 1);
    setIsPrestine(true);
    setFormValidationError(null);
  }

  function handleChange(event: FormEvent<HTMLFormElement>): void {
    const changedField = event.target as
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement;
    changedField.setCustomValidity('');
    setFormValidationError(null);
    const formData = new FormData(event.currentTarget);
    if (formData.get('firstName') !== defaultPersonInformation.firstName) {
      setIsPrestine(false);
    }
    if (formData.get('lastName') !== defaultPersonInformation.lastName) {
      setIsPrestine(false);
    }
    if (
      formData.get('organization') !== defaultPersonInformation.organization
    ) {
      setIsPrestine(false);
    }
    if (
      formData.get('emailAddress') !== defaultPersonInformation.emailAddress
    ) {
      setIsPrestine(false);
    }
    if (formData.get('phoneNumber') !== defaultPersonInformation.phoneNumber) {
      setIsPrestine(false);
    }
    if (formData.get('caseNumber') !== defaultCaseDetails.caseNumber) {
      setIsPrestine(false);
    }
    if (formData.get('description') !== defaultCaseDetails.description) {
      setIsPrestine(false);
    }
    if (formData.get('state') !== defaultCaseDetails.state) {
      setIsPrestine(false);
    }
    if (formData.get('county') !== defaultCaseDetails.county) {
      setIsPrestine(false);
    }
    if (formData.get('filingRole') !== defaultCaseDetails.filingRole) {
      setIsPrestine(false);
    }
    if (showBillingCode && formData.get('billingCode') !== defaultBillingCode) {
      setIsPrestine(false);
    }
    const defaultValueCurrentAttorney = defaultValue?.record?.currentAttorney;
    if (
      formData.get('currentAttorneyFirstName') !==
      defaultValueCurrentAttorney?.firstName
    ) {
      setIsPrestine(false);
    }
    if (
      formData.get('currentAttorneyLastName') !==
      defaultValueCurrentAttorney?.lastName
    ) {
      setIsPrestine(false);
    }
    if (
      formData.get('currentAttorneyFirmName') !==
      defaultValueCurrentAttorney?.firmName
    ) {
      setIsPrestine(false);
    }
    if (
      formData.get('currentAttorneyEmailAddress') !==
      defaultValueCurrentAttorney?.emailAddress
    ) {
      setIsPrestine(false);
    }
    if (
      formData.get('currentAttorneyPhoneNumber') !==
      defaultValueCurrentAttorney?.phoneNumber
    ) {
      setIsPrestine(false);
    }
    const defaultValueOpposition = defaultValue?.record?.opposition;
    if (
      formData.get('oppositionFirstName') !== defaultValueOpposition?.firstName
    ) {
      setIsPrestine(false);
    }
    if (
      formData.get('oppositionLastName') !== defaultValueOpposition?.lastName
    ) {
      setIsPrestine(false);
    }
    if (
      formData.get('oppositionOrganization') !==
      defaultValueOpposition?.organization
    ) {
      setIsPrestine(false);
    }
    if (
      formData.get('oppositionFilingRole') !==
      defaultValueOpposition?.filingRole
    ) {
      setIsPrestine(false);
    }
    if (
      formData.get('oppositionEmailAddress') !==
      defaultValueOpposition?.emailAddress
    ) {
      setIsPrestine(false);
    }
    if (
      formData.get('oppositionPhoneNumber') !==
      defaultValueOpposition?.phoneNumber
    ) {
      setIsPrestine(false);
    }
    const defaultValueOppositionAttorney =
      defaultValue?.record?.opposition?.currentAttorney;
    if (
      formData.get('oppositionAttorneyFirstName') !==
      defaultValueOppositionAttorney?.firstName
    ) {
      setIsPrestine(false);
    }
    if (
      formData.get('oppositionAttorneyLastName') !==
      defaultValueOppositionAttorney?.lastName
    ) {
      setIsPrestine(false);
    }
    if (
      formData.get('oppositionAttorneyFirmName') !==
      defaultValueOppositionAttorney?.firmName
    ) {
      setIsPrestine(false);
    }
    if (
      formData.get('oppositionAttorneyEmailAddress') !==
      defaultValueOppositionAttorney?.emailAddress
    ) {
      setIsPrestine(false);
    }
    if (
      formData.get('oppositionAttorneyPhoneNumber') !==
      defaultValueOppositionAttorney?.phoneNumber
    ) {
      setIsPrestine(false);
    }
  }

  return (
    <>
      {formValidationError && (
        <ModalDialog
          title="Validation Error"
          opened={true}
          submitText="OK"
          cancelText={null}
          onApproved={() => setFormValidationError(null)}>
          {formValidationError}
        </ModalDialog>
      )}
      <form
        id={formId}
        onSubmit={handleFormSubmit}
        onChange={handleChange}
        ref={formRef}
        className="mb-4 space-y-10">
      <FormSection id="case-details" title="Case Information" description="Identify the case and where it was filed." fieldsClassName="block">
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
          <div className="col-span-full">
            <CaseTextField
              title="Case Number"
              fieldName="caseNumber"
              defaultValue={defaultCaseDetails?.caseNumber || ''}
              readOnly={!isEditable}
            />
          </div>
          <div className="col-span-full">
            <CaseTextField
              title="Description"
              fieldName="description"
              defaultValue={defaultCaseDetails?.description || ''}
              readOnly={!isEditable}
            />
          </div>
          <div className="sm:col-span-3">
            <CaseSearchableField
              label="State"
              name="state"
              key={selectResetKey}
              options={stateOptions}
              placeholder={stateLoadError ? 'States unavailable' : 'Search states...'}
              value={stateJurisdictions || existingStateCode ? selectedStateCode : ''}
              onChange={(code) => {
                setSelectedStateCode(code);
                clearSelectValidation('state');
              }}
              disabled={!isEditable || (!stateJurisdictions && !existingStateCode)}
            />
            {stateLoadError && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-red-700 dark:text-red-300" role="alert">
                <span>States could not be loaded.</span>
                <button
                  type="button"
                  className="font-semibold underline"
                  onClick={() => setStateLoadAttempt((attempt) => attempt + 1)}>
                  Try again
                </button>
              </div>
            )}
          </div>
          <div className="sm:col-span-3">
            <CaseTextField
              title="County"
              fieldName="county"
              defaultValue={defaultCaseDetails?.county || ''}
              readOnly={!isEditable}
            />
          </div>
          <div className="sm:col-span-3">
            <CaseSearchableField
              label="Filing Role"
              ariaLabel="Case Filing Role"
              name="filingRole"
              key={selectResetKey}
              options={filingRoleOptions}
              placeholder="Search filing roles..."
              value={selectedFilingRole}
              onChange={(role) => {
                setSelectedFilingRole(role);
                clearSelectValidation('filingRole');
                const oppositeRole = complementaryFilingRoles[role];
                if (oppositeRole) {
                  setSelectedOppositionFilingRole(oppositeRole);
                  clearSelectValidation('oppositionFilingRole');
                }
              }}
              disabled={!isEditable}
            />
          </div>
          {showBillingCode && (
            <div className="sm:col-span-3">
              <CaseSearchableField
                label="Billing Code"
                name="billingCode"
                key={selectResetKey}
                options={billingCodeOptions}
                placeholder="Search billing codes..."
                value={selectedBillingCode}
                onChange={(code) => {
                  setSelectedBillingCode(code);
                  clearSelectValidation('billingCode');
                }}
                disabled={!isEditable}
              />
            </div>
          )}
        </div>
      </FormSection>
      <FormSection id="person-information" title="Person Information" description="Details for the person involved in this case." fieldsClassName="block">
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <CaseTextField
              title="First Name"
              fieldName="firstName"
              defaultValue={defaultPersonInformation?.firstName || ''}
              readOnly={!isEditable}
            />
          </div>
          <div className="sm:col-span-3">
            <CaseTextField
              title="Last Name"
              fieldName="lastName"
              defaultValue={defaultPersonInformation?.lastName || ''}
              readOnly={!isEditable}
            />
          </div>
          <div className="sm:col-span-3">
            <CaseTextField
              title="Organization"
              fieldName="organization"
              defaultValue={defaultPersonInformation?.organization || ''}
              readOnly={!isEditable}
            />
          </div>
          <div className="sm:col-span-3">
            <CaseTextField
              type="email"
              title="Email Address"
              fieldName="emailAddress"
              defaultValue={defaultPersonInformation?.emailAddress || ''}
              readOnly={!isEditable}
            />
          </div>
          <div className="col-span-full">
            <CaseTextField
              type="tel"
              title="Phone Number"
              fieldName="phoneNumber"
              defaultValue={defaultPersonInformation?.phoneNumber || ''}
              readOnly={!isEditable}
            />
          </div>
        </div>
      </FormSection>
      <FormSection id="current-attorney-information" title="Current Attorney" description="Contact details for the current attorney." fieldsClassName="block">
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <CaseTextField
              title="First Name"
              fieldName="currentAttorneyFirstName"
              defaultValue={defaultCurrentAttorney?.firstName || ''}
              readOnly={!isEditable}
            />
          </div>
          <div className="sm:col-span-3">
            <CaseTextField
              title="Last Name"
              fieldName="currentAttorneyLastName"
              defaultValue={defaultCurrentAttorney?.lastName || ''}
              readOnly={!isEditable}
            />
          </div>
          <div className="sm:col-span-3">
            <CaseTextField
              title="Firm Name"
              fieldName="currentAttorneyFirmName"
              defaultValue={defaultCurrentAttorney?.firmName || ''}
              readOnly={!isEditable}
            />
          </div>
          <div className="sm:col-span-3">
            <CaseTextField
              type="email"
              title="Email Address"
              fieldName="currentAttorneyEmailAddress"
              defaultValue={defaultCurrentAttorney?.emailAddress || ''}
              readOnly={!isEditable}
            />
          </div>
          <div className="col-span-full">
            <CaseTextField
              type="tel"
              title="Phone Number"
              fieldName="currentAttorneyPhoneNumber"
              defaultValue={defaultCurrentAttorney?.phoneNumber || ''}
              readOnly={!isEditable}
            />
          </div>
        </div>
      </FormSection>
      <FormSection id="opposition-information" title="Opposition Information" description="Details for the opposing party." fieldsClassName="block">
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <CaseTextField
              title="First Name"
              fieldName="oppositionFirstName"
              defaultValue={defaultOpposition?.firstName || ''}
              readOnly={!isEditable}
            />
          </div>
          <div className="sm:col-span-3">
            <CaseTextField
              title="Last Name"
              fieldName="oppositionLastName"
              defaultValue={defaultOpposition?.lastName || ''}
              readOnly={!isEditable}
            />
          </div>
          <div className="sm:col-span-3">
            <CaseTextField
              title="Organization"
              fieldName="oppositionOrganization"
              defaultValue={defaultOpposition?.organization || ''}
              readOnly={!isEditable}
            />
          </div>
          <div className="sm:col-span-3">
            <CaseSearchableField
              label="Filing Role"
              ariaLabel="Opposition Filing Role"
              name="oppositionFilingRole"
              key={selectResetKey}
              options={filingRoleOptions}
              placeholder="Search filing roles..."
              value={selectedOppositionFilingRole}
              onChange={(role) => {
                setSelectedOppositionFilingRole(role);
                clearSelectValidation('oppositionFilingRole');
                const oppositeRole = complementaryFilingRoles[role];
                if (oppositeRole) {
                  setSelectedFilingRole(oppositeRole);
                  clearSelectValidation('filingRole');
                }
              }}
              disabled={!isEditable}
            />
          </div>
          <div className="sm:col-span-3">
            <CaseTextField
              type="email"
              title="Email Address"
              fieldName="oppositionEmailAddress"
              defaultValue={defaultOpposition?.emailAddress || ''}
              readOnly={!isEditable}
            />
          </div>
          <div className="col-span-full">
            <CaseTextField
              type="tel"
              title="Phone Number"
              fieldName="oppositionPhoneNumber"
              defaultValue={defaultOpposition?.phoneNumber || ''}
              readOnly={!isEditable}
            />
          </div>
        </div>
      </FormSection>
      <FormSection id="opposing-attorney-information" title="Opposition's Attorney" description="Contact details for the opposing attorney." fieldsClassName="block">
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <CaseTextField
              title="First Name"
              fieldName="oppositionAttorneyFirstName"
              defaultValue={defaultOppositionAttorney?.firstName || ''}
              readOnly={!isEditable}
            />
          </div>
          <div className="sm:col-span-3">
            <CaseTextField
              title="Last Name"
              fieldName="oppositionAttorneyLastName"
              defaultValue={defaultOppositionAttorney?.lastName || ''}
              readOnly={!isEditable}
            />
          </div>
          <div className="sm:col-span-3">
            <CaseTextField
              title="Firm Name"
              fieldName="oppositionAttorneyFirmName"
              defaultValue={defaultOppositionAttorney?.firmName || ''}
              readOnly={!isEditable}
            />
          </div>
          <div className="sm:col-span-3">
            <CaseTextField
              type="email"
              title="Email Address"
              fieldName="oppositionAttorneyEmailAddress"
              defaultValue={defaultOppositionAttorney?.emailAddress || ''}
              readOnly={!isEditable}
            />
          </div>
          <div className="col-span-full">
            <CaseTextField
              type="tel"
              title="Phone Number"
              fieldName="oppositionAttorneyPhoneNumber"
              defaultValue={defaultOppositionAttorney?.phoneNumber || ''}
              readOnly={!isEditable}
            />
          </div>
        </div>
      </FormSection>
      {actionsContainer === undefined ? (
        <FormActions>
          {renderActions()}
        </FormActions>
      ) : actionsContainer ? (
        createPortal(renderActions(), actionsContainer)
      ) : null}
      </form>
    </>
  );

  function renderActions() {
    return (
      <div className="flex flex-wrap items-center gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20">
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={resetForm}
          disabled={isSubmitting}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20">
          Reset
        </button>
        <button
          type="submit"
          form={formId}
          disabled={!isEditable || isSubmitting || isPrestine || (!stateJurisdictions && !existingStateCode)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    );
  }
};
