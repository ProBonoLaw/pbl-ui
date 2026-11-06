import { logger } from '@/lib/logger';
import { SqlQuerySpec } from '@azure/cosmos';
import type { ZodIssue } from 'zod';
import { getCosmosContainer } from './cosmos';
import {
  Attorney,
  CaseDetailModel,
  UserAccount,
  UserAccountSchema,
  StoredUserAccount,
  StoredUserAccounts,
  StoredUserAccountsSchema,
  NotFoundException,
  OriginalCaseDetailsSchema,
  OriginalCaseRecord,
  type BillingCode,
  type CaseMap,
  isCaseAccountVisible,
} from './types';

export class AccountInfoValidationError extends Error {
  readonly issues: ZodIssue[];

  constructor(message: string, issues: ZodIssue[]) {
    super(message);
    this.name = 'AccountInfoValidationError';
    this.issues = issues;
  }
}

export function getUserAccountInfo(
  userId: string,
  accountId: string,
  filterOtherCases?: true,
  addRecord?: boolean,
): Promise<UserAccount | null>;
export function getUserAccountInfo(
  userId: string,
  accountId: string,
  filterOtherCases: false,
  addRecord?: boolean,
): Promise<StoredUserAccount | null>;
export async function getUserAccountInfo(
  userId: string,
  accountId: string,
  filterOtherCases: boolean = true,
  addRecord: boolean = true,
): Promise<UserAccount | StoredUserAccount | null> {
  const container = getCosmosContainer();

  const querySpec: SqlQuerySpec = {
    query:
      'SELECT * from c WHERE c.accountId = @accountId AND EXISTS(SELECT VALUE ca FROM ca IN c.casesAccounts WHERE ca.accountId = @caseId) AND array_contains(c.oids, @userId) ',
    parameters: [
      { name: '@accountId', value: '00000000-0000-0000-0000-000000000000' },
      { name: '@caseId', value: accountId },
      { name: '@userId', value: userId },
    ],
  };

  const { resources: userItems } = await container.items
    .query(querySpec)
    .fetchAll();
  if (userItems.length === 0) {
    throw new NotFoundException();
  }

  const refinedUserItems = StoredUserAccountsSchema.parse(userItems);

  if (!filterOtherCases) {
    const firstItem = refinedUserItems[0];
    if (addRecord) {
      for (const caseAccount of firstItem.casesAccounts) {
        if (caseAccount.accountId === accountId && !caseAccount.record) {
          caseAccount.record = (await getAccountInfo(accountId))?.data;
        }
      }
    }
    return firstItem;
  }

  const stripOtherCases = await refinedUserItems.map(async (item) => {
    item.casesAccounts = await Promise.all(
      item.casesAccounts
        .filter((ca) => ca.accountId === accountId && isCaseAccountVisible(ca))
        .map(async (ca) => {
          if (addRecord && !ca.record) {
            ca.record = (await getAccountInfo(accountId))?.data;
          }

          return ca;
        }),
    );
    return item;
  })?.[0];

  if (!stripOtherCases) {
    throw new NotFoundException();
  }

  return sanitizeUserAccount(stripOtherCases);
}

type OwnerCaseTermsInfo = Pick<UserAccount, 'type'> & {
  caseAccount?: Pick<CaseMap, 'billingCode'>;
};

export async function getTermsBillingCodeForGuestCase(
  caseId: string,
  caseAccount: CaseMap | undefined,
): Promise<BillingCode | undefined> {
  if (caseAccount?.isGuest !== true) {
    return caseAccount?.billingCode;
  }

  const container = getCosmosContainer();
  const querySpec: SqlQuerySpec = {
    query: `SELECT TOP 1 c.type, caseAccount
FROM c
JOIN caseAccount IN c.casesAccounts
WHERE c.accountId = @accountId
  AND caseAccount.accountId = @caseId
  AND (NOT IS_DEFINED(caseAccount.isGuest) OR caseAccount.isGuest != true)`,
    parameters: [
      { name: '@accountId', value: '00000000-0000-0000-0000-000000000000' },
      { name: '@caseId', value: caseId },
    ],
  };

  const { resources: items } = await container.items
    .query<OwnerCaseTermsInfo>(querySpec)
    .fetchAll();
  const ownerAccount = items[0];
  if (
    ownerAccount?.type === 'SHARED_RESOURCES' &&
    ownerAccount.caseAccount?.billingCode === 'D'
  ) {
    return 'D';
  }

  return caseAccount.billingCode;
}

export async function getAccountInfo(
  accountId: string,
): Promise<CaseDetailModel | null> {
  const container = getCosmosContainer();
  const querySpec: SqlQuerySpec = {
    query: `SELECT c.id,
    c.accountId,
    c.type,
    c.caseNumber,
    c.personInformation,
    c.attorneyInformation,
    c.filingRole,
    c.state,
    c.county,
    c.description,
    {
        "firstName": c.opposition.firstName,
        "lastName": c.opposition.lastName,
        "emailAddress": c.opposition.emailAddress,
        "phoneNumber": c.opposition.phoneNumber,
        "organization": c.opposition.organization,
        "filingRole": c.opposition.filingRole,
        "attorneyInformation": c.opposition.attorneyInformation,
        "currentAttorney": b
    } as opposition,
    a as currentAttorney,
    c.dataSourceId,
    c.ingestionServiceAccount,
    c.searchEndpoint,
    c.secretname,
    c.extendedControls
    FROM c
    JOIN a in c.attorneyInformation
    JOIN b in c.opposition.attorneyInformation
    WHERE c.accountId = @accountId and c.type = @type and a.isCurrent = @isCurrent and b.isCurrent = @isCurrent`,
    parameters: [
      { name: '@accountId', value: accountId },
      { name: '@type', value: 'ACCOUNT_DETAILS' },
      { name: '@isCurrent', value: true },
    ],
  };

  const { resources: items } = await container.items
    .query(querySpec)
    .fetchAll();
  const account = items.length > 0 ? items[0] : null;
  return account ? CaseDetailModel.parse(account) : null;
}

const isStringEmpty = (str: string | undefined): boolean => {
  return !str || str.trim() === '';
};

const adjustAttorneyList = (
  currentAttorney?: Attorney,
  attorneyList?: Attorney[],
) => {
  const oldCurrentAttorney = attorneyList?.find(
    (attorney) => attorney.isCurrent,
  );
  logger.info(
    'Old current attorney:',
    oldCurrentAttorney,
    'New current attorney:',
    currentAttorney,
  );
  if (currentAttorney) {
    currentAttorney.isCurrent = true;
    if (
      isStringEmpty(oldCurrentAttorney?.firstName) &&
      isStringEmpty(oldCurrentAttorney?.lastName) &&
      isStringEmpty(oldCurrentAttorney?.emailAddress) &&
      isStringEmpty(oldCurrentAttorney?.phoneNumber) &&
      isStringEmpty(oldCurrentAttorney?.firmName)
    ) {
      const newAttorneyList = attorneyList?.filter(
        (attorney) => !attorney.isCurrent,
      );
      newAttorneyList?.push(currentAttorney);
      return newAttorneyList;
    } else {
      if (
        currentAttorney.firstName === oldCurrentAttorney?.firstName &&
        currentAttorney.lastName === oldCurrentAttorney?.lastName &&
        currentAttorney.emailAddress === oldCurrentAttorney?.emailAddress &&
        currentAttorney.phoneNumber === oldCurrentAttorney?.phoneNumber &&
        currentAttorney.firmName === oldCurrentAttorney?.firmName
      ) {
        // No changes in current attorney details
        return attorneyList?.slice();
      }

      const potentialDuplicates = attorneyList?.filter(
        (attorney) =>
          attorney.firstName === currentAttorney.firstName &&
          attorney.lastName === currentAttorney.lastName,
      );
      if (potentialDuplicates && potentialDuplicates.length > 1) {
        logger.warn(
          'Multiple potential duplicate current attorneys found:',
          potentialDuplicates,
        );
        // Remove all duplicates except the first one
        const newAttorneyList = attorneyList?.filter(
          (attorney) =>
            !(
              attorney.firstName === currentAttorney.firstName &&
              attorney.lastName === currentAttorney.lastName
            ),
        );
        newAttorneyList?.push(currentAttorney);
        return newAttorneyList;
      }

      const newAttorneyList = attorneyList?.map((attorney) => {
        if (attorney.isCurrent) {
          attorney.isCurrent = false;
        }
        return attorney;
      });

      logger.info(
        'Updating current attorney from:',
        oldCurrentAttorney,
        'to:',
        currentAttorney,
      );
      newAttorneyList?.push(currentAttorney);
      return newAttorneyList;
    }
  }
  return attorneyList?.slice();
};

export async function updateAccountInfo(
  userId: string,
  accountId: string,
  data?: Partial<OriginalCaseRecord>,
): Promise<UserAccount | null> {
  if (!data) {
    return null;
  }

  const container = getCosmosContainer();
  const account = (await getAccountInfo(accountId))?.data;
  if (!account) {
    return null;
  }
  // Protect immutability of certain fields by overriding them with existing values
  const dataSourceId = account.dataSourceId!;
  const secretName = account.secretname!;
  const searchEndpoint = account.searchEndpoint!;
  const updatedAccount = { ...account, ...data };
  logger.info('Updating account:', updatedAccount);
  updatedAccount.currentAttorney = undefined; // Prevent updating nested currentAttorney directly
  const newOpposition = { ...account.opposition, ...data.opposition };
  newOpposition.currentAttorney = undefined;
  const adjustedAttorneyList = adjustAttorneyList(
    data.currentAttorney,
    account.attorneyInformation,
  );
  if (adjustedAttorneyList) {
    updatedAccount.attorneyInformation = adjustedAttorneyList;
  }
  const adjustedOppositionAttorneyList = adjustAttorneyList(
    data.opposition?.currentAttorney,
    account.opposition.attorneyInformation,
  );
  if (adjustedOppositionAttorneyList) {
    newOpposition.attorneyInformation = adjustedOppositionAttorneyList;
    updatedAccount.opposition = newOpposition;
  }
  updatedAccount.dataSourceId = dataSourceId;
  updatedAccount.secretname = secretName;
  updatedAccount.searchEndpoint = searchEndpoint;
  const validatedUpdatedAccount =
    OriginalCaseDetailsSchema.safeParse(updatedAccount);
  if (!validatedUpdatedAccount.success) {
    throw new AccountInfoValidationError(
      'Updated account data failed schema validation',
      validatedUpdatedAccount.error.issues,
    );
  }
  await container
    .item(account.id!, account.accountId!)
    .replace(validatedUpdatedAccount.data);

  const refreshedAccount = await getUserAccountInfo(userId, accountId);
  if (!refreshedAccount) {
    return null;
  }
  return refreshedAccount;
}

export function stripSensitiveInfo(
  account: OriginalCaseRecord,
): OriginalCaseRecord {
  // Removing sensitive information from the account object before sending it to the client
  const strippedAccount = { ...account };
  delete strippedAccount.dataSourceId;
  delete strippedAccount.ingestionServiceAccount;
  delete strippedAccount.secretname;
  return strippedAccount;
}

export function sanitizeUserAccount(account: StoredUserAccount): UserAccount {
  const sanitizedCasesAccounts = account.casesAccounts
    .filter((caseAccount) => isCaseAccountVisible(caseAccount))
    .map((caseAccount) => ({
      ...caseAccount,
      record: caseAccount.record
        ? stripSensitiveInfo(caseAccount.record)
        : caseAccount.record,
    }));
  return UserAccountSchema.parse({
    ...account,
    casesAccounts: sanitizedCasesAccounts,
  });
}

export function sanitizeUserAccounts(
  accounts: StoredUserAccounts,
): UserAccount[] {
  const sanitizedAccounts = accounts.map((account) =>
    sanitizeUserAccount(account),
  );
  return sanitizedAccounts;
}
