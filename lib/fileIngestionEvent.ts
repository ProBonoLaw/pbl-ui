import { logger } from '@/lib/logger';
import type { FileIngestionRequest } from '@/lib/fileIngestionRequest';
import { EventHubProducerClient } from '@azure/event-hubs';

const MAX_FILE_INGESTION_ATTEMPTS = 3;

export class FileIngestionSubmissionError extends Error {
  constructor(cause: unknown) {
    super('Unable to submit file ingestion after three attempts.', { cause });
    this.name = 'FileIngestionSubmissionError';
  }
}

function waitForRetry(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, attempt * 250));
}

async function sendFileIngestionEvent(
  connectionString: string,
  hubName: string,
  event: FileIngestionRequest,
): Promise<void> {
  const producer = new EventHubProducerClient(connectionString, hubName);
  try {
    await producer.sendBatch([{ body: event }]);
  } finally {
    try {
      await producer.close();
    } catch (error) {
      logger.error(
        'Failed to close file ingestion Event Hubs producer:',
        error,
      );
    }
  }
}

export async function requestFileIngestion(
  event: FileIngestionRequest,
): Promise<void> {
  const connectionString =
    process.env.AZURE_EVENT_FILE_INGESTION_CONNECTION_STRING ??
    process.env.AZURE_EVENT_HUB_ACCOUNT_MANAGEMENT_CONNECTION_STRING;
  const hubName =
    process.env.AZURE_EVENT_FILE_INGESTION_HUB_NAME ?? 'file-operations';
  if (!connectionString) {
    throw new FileIngestionSubmissionError(
      new Error('File ingestion Event Hubs connection string is missing.'),
    );
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_FILE_INGESTION_ATTEMPTS; attempt += 1) {
    try {
      await sendFileIngestionEvent(connectionString, hubName, event);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === MAX_FILE_INGESTION_ATTEMPTS) {
        break;
      }
      logger.warn(
        `File ingestion Event Hubs submission failed (attempt ${attempt}/${MAX_FILE_INGESTION_ATTEMPTS}); retrying.`,
        error,
      );
      await waitForRetry(attempt);
    }
  }

  throw new FileIngestionSubmissionError(lastError);
}
