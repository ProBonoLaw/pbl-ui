import { getCosmosContainer } from '@/lib/cosmos';
import { CaseAccountSchema, isCaseAccountVisible } from '@/lib/types';
import {
  evaluateCaseFeaturePolicy,
  evaluateUserAccessPolicy,
  type CaseFeatureKey,
} from '@/lib/userAccessPolicy';
import { SqlQuerySpec } from '@azure/cosmos';

const ROOT_ACCOUNT_ID = '00000000-0000-0000-0000-000000000000';

type AccessOptions = {
  requireAgreedToTerms?: boolean;
  requireIsActive?: boolean;
};

type CaseAccessOptions = {
  requireIsActive?: boolean;
  allowInactiveGuestAccess?: boolean;
  requireCaseTerms?: boolean;
  requiredFeature?: CaseFeatureKey;
};

type UserAccessState = {
  agreedToTerms: boolean;
  isActive: boolean;
};

export class UserAccessError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function requireUserAccess(
  oid: string,
  options: AccessOptions = {},
): Promise<UserAccessState> {
  const container = getCosmosContainer();
  const querySpec: SqlQuerySpec = {
    query:
      'SELECT TOP 1 c.id, c.agreedToTerms, c.isActive from c WHERE c.accountId = @accountId AND array_contains(c.oids, @oid)',
    parameters: [
      { name: '@accountId', value: ROOT_ACCOUNT_ID },
      { name: '@oid', value: oid },
    ],
  };

  const { resources: items } = await container.items
    .query(querySpec)
    .fetchAll();
  if (!items.length) {
    throw new UserAccessError(
      'User account is not initialized.',
      403,
      'ACCOUNT_NOT_INITIALIZED',
    );
  }

  const agreedToTerms = items[0].agreedToTerms === true;
  const isActive = items[0].isActive === true;

  const policy = evaluateUserAccessPolicy({
    agreedToTerms,
    isActive,
    requireAgreedToTerms: options.requireAgreedToTerms,
    requireIsActive: options.requireIsActive,
  });
  if (!policy.allowed) {
    throw new UserAccessError(policy.message!, 403, policy.code!);
  }

  return { agreedToTerms, isActive };
}

export async function requireUserCaseAccess(
  oid: string,
  caseId: string,
  options: CaseAccessOptions = {},
) {
  const container = getCosmosContainer();
  const querySpec: SqlQuerySpec = {
    query: `SELECT TOP 1 caseAccount
FROM c
JOIN caseAccount IN c.casesAccounts
WHERE c.accountId = @accountId
  AND array_contains(c.oids, @oid)
  AND caseAccount.accountId = @caseId`,
    parameters: [
      { name: '@accountId', value: ROOT_ACCOUNT_ID },
      { name: '@oid', value: oid },
      { name: '@caseId', value: caseId },
    ],
  };

  const { resources: items } = await container.items
    .query(querySpec)
    .fetchAll();
  if (!items.length) {
    throw new UserAccessError(
      'You do not have access to this case.',
      403,
      'CASE_ACCESS_FORBIDDEN',
    );
  }

  const caseAccount = CaseAccountSchema.parse(items[0].caseAccount);
  if (!isCaseAccountVisible(caseAccount)) {
    throw new UserAccessError(
      'You do not have access to this case.',
      403,
      'CASE_ACCESS_FORBIDDEN',
    );
  }

  if (
    options.requireIsActive &&
    !(options.allowInactiveGuestAccess === true && caseAccount.isGuest === true)
  ) {
    await requireUserAccess(oid, { requireIsActive: true });
  }

  const featurePolicy = evaluateCaseFeaturePolicy({
    agreedToCaseTerms:
      options.requireCaseTerms === false
        ? true
        : caseAccount.agreedToCaseTerms === true,
    isGuest: caseAccount.isGuest === true,
    requiredFeature: options.requiredFeature,
    canGenerateDeclaration: caseAccount.canGenerateDeclaration,
    canUseQA: caseAccount.canUseQA,
    canAccessDocuments: caseAccount.canAccessDocuments,
  });
  if (!featurePolicy.allowed) {
    throw new UserAccessError(featurePolicy.message!, 403, featurePolicy.code!);
  }

  return caseAccount;
}
