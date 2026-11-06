'use server';
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

function getStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const errorRecord = err as Record<string, unknown>;
  const statusCode = errorRecord.statusCode;
  const status = errorRecord.status;
  if (typeof statusCode === 'number') return statusCode;
  if (typeof status === 'number') return status;
  return undefined;
}

function getCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const code = (err as Record<string, unknown>).code;
  return typeof code === 'string' ? code : undefined;
}

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/staff/[staffid]/photo'>,
): Promise<NextResponse> {
  const { staffid } = await ctx.params;

  const accountName = process.env.STORAGE_ACCOUNT_NAME;
  const containerName = process.env.STAFF_PHOTO_CONTAINER_NAME;

  if (!accountName || !containerName) {
    logger.error('Missing STORAGE_ACCOUNT_NAME or STAFF_PHOTO_CONTAINER_NAME');
    return NextResponse.json(
      { error: 'Server misconfiguration' },
      { status: 500 },
    );
  }

  const credential = new DefaultAzureCredential();
  const blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    credential,
  );

  const containerClient = blobServiceClient.getContainerClient(containerName);

  // Adjust this if your blobs are stored as `${staffid}.jpg` etc.
  const blobClient = containerClient.getBlobClient(staffid);

  try {
    // Fetch metadata first so you can set Content-Type reliably
    const props = await blobClient.getProperties();
    const contentType = props.contentType ?? 'application/octet-stream';

    const imageBuffer = await blobClient.downloadToBuffer();
    if (!imageBuffer?.length) {
      // If it's truly empty, treat as not found or data issue
      return NextResponse.json(
        { error: 'Staff photo not available' },
        { status: 404 },
      );
    }

    return new NextResponse(new Uint8Array(imageBuffer), {
      headers: {
        'Content-Type': contentType,
        // Choose one policy; this is a reasonable default for non-sensitive images
        'Cache-Control': 'public, max-age=300',
        // Optional: allow conditional caching if you surface an etag
        ...(props.etag ? { ETag: props.etag } : {}),
      },
    });
  } catch (err) {
    const status = getStatus(err);
    const code = getCode(err);

    if (status === 404) {
      return NextResponse.json(
        { error: 'Staff photo not found' },
        { status: 404 },
      );
    }

    // transient/upstream-ish problems
    if (
      status === 429 ||
      (status && status >= 500) ||
      code === 'ETIMEDOUT' ||
      code === 'ECONNRESET' ||
      code === 'ENOTFOUND'
    ) {
      logger.error('Azure Blob Storage unavailable:', err);
      return NextResponse.json(
        { error: 'Storage service unavailable' },
        { status: 503 },
      );
    }

    logger.error('Failed to fetch staff photo from Azure Blob Storage:', err);
    return NextResponse.json(
      { error: 'Failed to fetch staff photo' },
      { status: 500 },
    );
  }
}
