import type { RequestData } from '@/lib/types';

export type DisplayRequestStatus = RequestData['status'] | 'overdue';

const OVERDUE_AFTER_MS = 2 * 60 * 60 * 1000;

export function getRequestStatus(request: RequestData, now: number): DisplayRequestStatus {
  const startedAt = Date.parse(request.startedAt);
  return request.status === 'started' && Number.isFinite(startedAt) && now - startedAt > OVERDUE_AFTER_MS
    ? 'overdue'
    : request.status;
}
