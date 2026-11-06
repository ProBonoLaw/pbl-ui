import { FormSection } from '@/components/forms/FormSection';
import { CaseMap } from '@/lib/types';

function displayValue(value?: string) {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : 'N/A';
}

function DetailField({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value?: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? 'col-span-full' : 'sm:col-span-3'}>
      <dt className="block text-sm/6 font-medium text-gray-900 dark:text-white">
        {label}
      </dt>
      <dd className="mt-2 flex min-h-9 items-center rounded-md bg-gray-50 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-200 [overflow-wrap:anywhere] whitespace-pre-wrap sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10">
        {displayValue(value)}
      </dd>
    </div>
  );
}

export const CaseProfile = ({ data }: { data: CaseMap }) => {
  const caseData = data.record;
  if (!caseData) {
    return <div>No case data available.</div>;
  }

  const billingTierLabel =
    data.billingCode === 'F'
      ? 'Pro Bono'
      : data.billingCode === 'S1'
        ? 'Silver'
        : data.billingCode === 'G1'
          ? 'Gold'
          : data.billingCode === 'D'
            ? 'Demo'
            : 'N/A';
  const fieldsClassName = 'block';
  const gridClassName = 'grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6';

  return (
    <div className="mb-4 space-y-10">
      <FormSection
        id="case-details"
        title="Case Information"
        description="Identify the case and where it was filed."
        fieldsClassName={fieldsClassName}>
        <dl className={gridClassName}>
          <DetailField label="Case Number" value={caseData.caseNumber} fullWidth />
          <DetailField label="Description" value={caseData.description} fullWidth />
          <DetailField label="State" value={caseData.state} />
          <DetailField label="County" value={caseData.county} />
          <DetailField label="Filing Role" value={caseData.filingRole} />
          <DetailField label="Billing Tier" value={billingTierLabel} />
        </dl>
      </FormSection>

      <FormSection
        id="person-information"
        title="Person Information"
        description="Details for the person involved in this case."
        fieldsClassName={fieldsClassName}>
        <dl className={gridClassName}>
          <DetailField label="First Name" value={caseData.personInformation?.firstName} />
          <DetailField label="Last Name" value={caseData.personInformation?.lastName} />
          <DetailField label="Organization" value={caseData.personInformation?.organization} />
          <DetailField label="Email Address" value={caseData.personInformation?.emailAddress} />
          <DetailField label="Phone Number" value={caseData.personInformation?.phoneNumber} fullWidth />
        </dl>
      </FormSection>

      <FormSection
        id="current-attorney-information"
        title="Current Attorney"
        description="Contact details for the current attorney."
        fieldsClassName={fieldsClassName}>
        <dl className={gridClassName}>
          <DetailField label="First Name" value={caseData.currentAttorney?.firstName} />
          <DetailField label="Last Name" value={caseData.currentAttorney?.lastName} />
          <DetailField label="Firm Name" value={caseData.currentAttorney?.firmName} />
          <DetailField label="Email Address" value={caseData.currentAttorney?.emailAddress} />
          <DetailField label="Phone Number" value={caseData.currentAttorney?.phoneNumber} fullWidth />
        </dl>
      </FormSection>

      <FormSection
        id="opposition-information"
        title="Opposition Information"
        description="Details for the opposing party."
        fieldsClassName={fieldsClassName}>
        <dl className={gridClassName}>
          <DetailField label="First Name" value={caseData.opposition?.firstName} />
          <DetailField label="Last Name" value={caseData.opposition?.lastName} />
          <DetailField label="Organization" value={caseData.opposition?.organization} />
          <DetailField label="Filing Role" value={caseData.opposition?.filingRole} />
          <DetailField label="Email Address" value={caseData.opposition?.emailAddress} />
          <DetailField label="Phone Number" value={caseData.opposition?.phoneNumber} fullWidth />
        </dl>
      </FormSection>

      <FormSection
        id="opposing-attorney-information"
        title="Opposition's Attorney"
        description="Contact details for the opposing attorney."
        fieldsClassName={fieldsClassName}>
        <dl className={gridClassName}>
          <DetailField label="First Name" value={caseData.opposition.currentAttorney?.firstName} />
          <DetailField label="Last Name" value={caseData.opposition.currentAttorney?.lastName} />
          <DetailField label="Firm Name" value={caseData.opposition.currentAttorney?.firmName} />
          <DetailField label="Email Address" value={caseData.opposition.currentAttorney?.emailAddress} />
          <DetailField label="Phone Number" value={caseData.opposition.currentAttorney?.phoneNumber} fullWidth />
        </dl>
      </FormSection>
    </div>
  );
};
