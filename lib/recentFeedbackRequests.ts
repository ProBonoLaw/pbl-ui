export type RecentFeedbackRequest = {
  id: string;
  accountId: string;
  status: string;
  createdAt: string;
  isAccountOwned: boolean;
};

const MAX_FEEDBACK_PROMPT_AGE_MS = 3 * 24 * 60 * 60 * 1000;

function isRecentFeedbackRequest(value: unknown): value is RecentFeedbackRequest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const request = value as Record<string, unknown>;
  return (
    typeof request.id === 'string' &&
    request.id.length > 0 &&
    typeof request.accountId === 'string' &&
    request.accountId.length > 0 &&
    typeof request.status === 'string' &&
    typeof request.createdAt === 'string' &&
    typeof request.isAccountOwned === 'boolean'
  );
}

export function findRecentPendingFeedbackRequest(
  value: unknown,
  now: Date = new Date(),
): RecentFeedbackRequest | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const oldestAllowedTime = now.getTime() - MAX_FEEDBACK_PROMPT_AGE_MS;
  return (
    value.find((entry) => {
      if (!isRecentFeedbackRequest(entry) || !entry.isAccountOwned) {
        return false;
      }
      if (entry.status === 'completed') {
        return false;
      }

      const createdAt = new Date(entry.createdAt).getTime();
      return !Number.isNaN(createdAt) && createdAt > oldestAllowedTime;
    }) ?? null
  );
}
