import 'server-only';

import { getCosmosContainer } from '@/lib/cosmos';
import {
  ClientFeedbackRequestSchema,
  type ClientFeedbackRequest,
  type SpeakerNameFeedbackResponse,
} from '@/lib/types';
import { SqlQuerySpec } from '@azure/cosmos';

const CLIENT_FEEDBACK_REQUESTS_CONTAINER =
  process.env.COSMOS_SQL_CLIENT_FEEDBACK_REQUEST_CONTAINER ??
  'clientFeedbackRequests';

function isCosmosNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const { code, statusCode } = error as {
    code?: unknown;
    statusCode?: unknown;
  };
  return code === 'NotFound' || code === 404 || statusCode === 404;
}

export async function findClientFeedbackRequest(
  accountId: string,
  requestId: string,
): Promise<ClientFeedbackRequest | null> {
  const container = getCosmosContainer(CLIENT_FEEDBACK_REQUESTS_CONTAINER);
  const querySpec: SqlQuerySpec = {
    query:
      'SELECT TOP 1 * FROM c WHERE c.accountId = @accountId AND c.id = @requestId',
    parameters: [
      { name: '@accountId', value: accountId },
      { name: '@requestId', value: requestId },
    ],
  };
  const { resources } = await container.items.query(querySpec).fetchAll();

  if (!resources[0]) {
    return null;
  }

  const feedbackRequest = ClientFeedbackRequestSchema.safeParse(resources[0]);
  return feedbackRequest.success ? feedbackRequest.data : null;
}

export async function listClientFeedbackRequests(
  accountIds: readonly string[],
): Promise<ClientFeedbackRequest[]> {
  const uniqueAccountIds = [
    ...new Set(accountIds.filter((accountId) => accountId.length > 0)),
  ];
  if (uniqueAccountIds.length === 0) {
    return [];
  }

  const container = getCosmosContainer(CLIENT_FEEDBACK_REQUESTS_CONTAINER);
  const querySpec: SqlQuerySpec = {
    query: `
      SELECT * FROM c
      WHERE c.type = @type AND ARRAY_CONTAINS(@accountIds, c.accountId)
      ORDER BY c.createdAt DESC
    `,
    parameters: [
      { name: '@type', value: 'speakerNames' },
      { name: '@accountIds', value: uniqueAccountIds },
    ],
  };
  let resources: unknown[];
  try {
    ({ resources } = await container.items.query(querySpec).fetchAll());
  } catch (error) {
    // Feedback requests are provisioned only after the first request. Treat an
    // absent container the same as a container with no requests.
    if (isCosmosNotFound(error)) {
      return [];
    }
    throw error;
  }

  return resources.flatMap((resource) => {
    const feedbackRequest = ClientFeedbackRequestSchema.safeParse(resource);
    return feedbackRequest.success ? [feedbackRequest.data] : [];
  });
}

export async function completeSpeakerNameFeedback(
  feedbackRequest: ClientFeedbackRequest,
  response: SpeakerNameFeedbackResponse,
) {
  const container = getCosmosContainer(CLIENT_FEEDBACK_REQUESTS_CONTAINER);

  return container.item(feedbackRequest.id, feedbackRequest.accountId).patch({
    operations: [
      { op: 'set', path: '/response', value: response },
      { op: 'set', path: '/status', value: 'completed' },
    ],
  });
}

export async function setClientFeedbackRequestStatus(
  feedbackRequest: ClientFeedbackRequest,
  status: 'pending' | 'completed',
) {
  const container = getCosmosContainer(CLIENT_FEEDBACK_REQUESTS_CONTAINER);

  return container.item(feedbackRequest.id, feedbackRequest.accountId).patch({
    operations: [{ op: 'set', path: '/status', value: status }],
  });
}
