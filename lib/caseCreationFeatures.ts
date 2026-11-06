export type CaseCreationFeatures = {
  addGoldFeatures: boolean;
  useDedicatedEmailAddress: boolean;
};

export function getCaseCreationFeatures(
  billingCode: string | null | undefined,
  callerIsAttorney = false,
): CaseCreationFeatures {
  const addGoldFeatures =
    billingCode === 'G1' || (billingCode === 'F' && callerIsAttorney);
  return {
    addGoldFeatures,
    useDedicatedEmailAddress: addGoldFeatures,
  };
}
