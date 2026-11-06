import type { OriginalCaseRecord } from './types.ts';

function getPartyDisplayName(party?: {
  firstName?: string;
  lastName?: string;
  organization?: string;
}): string {
  if (!party) {
    return 'Unknown';
  }

  const fullName = [party.firstName, party.lastName]
    .map((value) => (value ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  if (fullName) {
    return fullName;
  }

  const organization = (party.organization ?? '').trim();
  if (organization) {
    return organization;
  }

  return 'Unknown';
}

export function printTitle(caseRecord?: OriginalCaseRecord): string {
  if (!caseRecord) {
    return 'Unknown';
  }

  const nickname = (caseRecord.nickname ?? '').trim();
  if (nickname) {
    return nickname;
  }

  let firstEntry: string | undefined;
  let lastEntry: string | undefined;
  if (
    caseRecord.filingRole === 'Petitioner' ||
    caseRecord.filingRole === 'Plaintiff'
  ) {
    firstEntry = getPartyDisplayName(caseRecord.personInformation);
    lastEntry = getPartyDisplayName(caseRecord.opposition);
  } else {
    firstEntry = getPartyDisplayName(caseRecord.opposition);
    lastEntry = getPartyDisplayName(caseRecord.personInformation);
  }
  return `${firstEntry} v. ${lastEntry}`;
}
