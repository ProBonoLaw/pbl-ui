// The directory extension name contains the deployment's application ID.
// Keep it in deployment configuration; local tests use a synthetic field name.
export function getAttorneyExtensionName() {
  return process.env.NEXT_PUBLIC_AAD_ATTORNEY_EXTENSION || 'extension_example_IsAttorney';
}

export function normalizeGraphAttorneyField(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const data = value as Record<string, unknown>;
  const { [getAttorneyExtensionName()]: attorney, ...profile } = data;
  return { ...profile, isAttorney: attorney ?? profile.isAttorney ?? null };
}

// Accept a deployed older client's extension field while newer clients use the
// stable isAttorney property. Unrelated patches must not acquire a new field.
export function normalizeGraphAttorneyPatch(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const data = value as Record<string, unknown>;
  const name = getAttorneyExtensionName();
  if (!Object.hasOwn(data, name)) return data;
  const { [name]: isAttorney, ...profile } = data;
  return { ...profile, isAttorney };
}
