import { RequestDataSchema } from './types.ts';

const requestSummaryFields = {
  id: true,
  accountId: true,
  sessionId: true,
  input: true,
  type: true,
  status: true,
  oid: true,
  startedAt: true,
  endedAt: true,
} as const;

export const REQUEST_SUMMARY_SELECT = Object.keys(requestSummaryFields)
  .map((field) => `c.${field}`)
  .join(', ');

const RequestSummaryArraySchema = RequestDataSchema.pick(requestSummaryFields).array();

export function parseRequestSummaries(input: unknown) {
  return RequestSummaryArraySchema.parse(input);
}
