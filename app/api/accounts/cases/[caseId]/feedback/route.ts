'use server';
import { logger } from '@/lib/logger';

import { internalServerErrorResponse } from '@/lib/apiResponses';
import { getCosmosContainer } from '@/lib/cosmos';
import {
  FeedbackScreenshot,
  FeedbackScreenshotsSchema,
} from '@/lib/types';
import { validateTokenOrNull } from '@/lib/validateToken';
import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient } from '@azure/storage-blob';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { NextRequest, NextResponse } from 'next/server';

const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';
const FEEDBACK_IMAGES_CONTAINER = 'feedback-images';
const FEEDBACK_COSMOS_CONTAINER = 'feedback';
const OPERATION_NAME = 'POST /api/accounts/cases/[caseId]/feedback';
const MAX_SCREENSHOT_COUNT = 5;
const MAX_SCREENSHOT_SIZE_BYTES = 2 * 1_000_000;
const MAX_TOTAL_SCREENSHOT_SIZE_BYTES = 8 * 1_000_000;
const ALLOWED_SCREENSHOT_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

function toSafeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]/g, '_');
}

async function resolveOidFromRequest(request: NextRequest): Promise<string> {
  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) {
    return EMPTY_UUID;
  }

  let payload: Awaited<ReturnType<typeof validateTokenOrNull>>;
  try {
    payload = await validateTokenOrNull(token, OPERATION_NAME);
  } catch (error) {
    logger.error(
      'Token validation infrastructure failure during POST /api/accounts/cases/[caseId]/feedback:',
      error,
    );
    throw error;
  }

  const oid = payload?.oid;
  return typeof oid === 'string' && oid.length > 0 ? oid : EMPTY_UUID;
}

function validateScreenshots(screenshots: File[]): NextResponse | null {
  if (screenshots.length > MAX_SCREENSHOT_COUNT) {
    return NextResponse.json(
      {
        error: `Too many screenshots. Maximum is ${MAX_SCREENSHOT_COUNT}.`,
      },
      { status: 413 },
    );
  }

  let totalSizeBytes = 0;
  for (const file of screenshots) {
    if (!ALLOWED_SCREENSHOT_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error:
            'Unsupported screenshot content type. Allowed types: image/png, image/jpeg, image/webp.',
        },
        { status: 415 },
      );
    }

    if (file.size > MAX_SCREENSHOT_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `Screenshot is too large. Maximum per file is ${MAX_SCREENSHOT_SIZE_BYTES} bytes.`,
        },
        { status: 413 },
      );
    }

    totalSizeBytes += file.size;
    if (totalSizeBytes > MAX_TOTAL_SCREENSHOT_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `Total screenshots size is too large. Maximum total is ${MAX_TOTAL_SCREENSHOT_SIZE_BYTES} bytes.`,
        },
        { status: 413 },
      );
    }
  }

  return null;
}

async function uploadScreenshots(
  screenshots: File[],
  screenshotTypes: string[],
  caseId: string,
  oid: string,
): Promise<FeedbackScreenshot[]> {
  if (screenshots.length === 0) {
    return [];
  }

  const accountName = process.env.STORAGE_ACCOUNT_NAME;
  if (!accountName) {
    throw new Error('Missing STORAGE_ACCOUNT_NAME env var');
  }

  const blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    new DefaultAzureCredential(),
  );

  const containerClient = blobServiceClient.getContainerClient(
    FEEDBACK_IMAGES_CONTAINER,
  );
  await containerClient.createIfNotExists();

  const timestamp = Date.now();
  const uploaded: FeedbackScreenshot[] = [];

  for (const [index, file] of screenshots.entries()) {
    const contentType = file.type;
    const extensionByType: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
    };
    const safeExtension = extensionByType[contentType] || 'bin';

    const blobName =
      `${toSafeSegment(caseId)}/${toSafeSegment(oid)}/` +
      `${timestamp}-${index}-${crypto.randomUUID()}.${safeExtension}`;

    const blobClient = containerClient.getBlockBlobClient(blobName);

    await blobClient.uploadStream(
      Readable.fromWeb(file.stream() as unknown as NodeReadableStream<Uint8Array>),
      undefined,
      undefined,
      {
        blobHTTPHeaders: {
          blobContentType: contentType,
        },
      },
    );

    uploaded.push({
      url: blobClient.url,
      blobName,
      contentType,
      sizeBytes: file.size,
      screenshotType: screenshotTypes[index] || 'unknown',
    });
  }

  return uploaded;
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/cases/[caseId]/feedback'>,
) {
  const { caseId } = await ctx.params;
  const accountId = caseId?.trim() || EMPTY_UUID;

  try {
    const oid = await resolveOidFromRequest(request);

    const formData = await request.formData();
    const messageValue = formData.get('message');
    const emailValue = formData.get('email');

    if (typeof messageValue !== 'string' || messageValue.trim().length === 0) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const screenshotTypes = formData
      .getAll('screenshotType')
      .map((value) => (typeof value === 'string' ? value : 'unknown'));

    const screenshots = formData
      .getAll('screenshots')
      .filter((value): value is File => value instanceof File);

    const screenshotsValidationError = validateScreenshots(screenshots);
    if (screenshotsValidationError) {
      return screenshotsValidationError;
    }

    const uploadedScreenshots = await uploadScreenshots(
      screenshots,
      screenshotTypes,
      accountId,
      oid,
    );
    const parsedUploadedScreenshots =
      FeedbackScreenshotsSchema.parse(uploadedScreenshots);

    const feedbackContainer = getCosmosContainer(FEEDBACK_COSMOS_CONTAINER);
    const createdAt = new Date().toISOString();

    const feedback = {
      id: crypto.randomUUID(),
      oid,
      accountId,
      message: messageValue.trim(),
      email:
        typeof emailValue === 'string' && emailValue.trim().length > 0
          ? emailValue.trim()
          : null,
      screenshots: parsedUploadedScreenshots,
      createdAt,
      updatedAt: createdAt,
    };

    await feedbackContainer.items.create(feedback);

    return NextResponse.json(
      {
        id: feedback.id,
        oid: feedback.oid,
        accountId: feedback.accountId,
        screenshotCount: parsedUploadedScreenshots.length,
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error('Error creating feedback entry:', error);
    return internalServerErrorResponse('Failed to submit feedback');
  }
}
