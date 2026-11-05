export const MAX_DOCUMENT_UPLOAD_SIZE = 250 * 1_000_000;
export const MAX_DOCUMENT_UPLOAD_REQUEST_SIZE =
  MAX_DOCUMENT_UPLOAD_SIZE + 1_000_000;
export const MAX_DOCUMENT_UPLOAD_FILES = 1;

type UploadContentLengthError = {
  status: 400 | 411 | 413;
  error: string;
};

/**
 * Bounds multipart buffering before Request.formData() is called. The extra
 * megabyte permits multipart boundaries and headers around a 250 MB file.
 */
export function validateDocumentUploadContentLength(
  contentLength: string | null,
): UploadContentLengthError | null {
  if (!contentLength) {
    return {
      status: 411,
      error: 'Content-Length is required for document uploads.',
    };
  }

  if (!/^\d+$/.test(contentLength)) {
    return { status: 400, error: 'Invalid Content-Length header.' };
  }

  const size = Number(contentLength);
  if (!Number.isSafeInteger(size)) {
    return { status: 400, error: 'Invalid Content-Length header.' };
  }

  if (size > MAX_DOCUMENT_UPLOAD_REQUEST_SIZE) {
    return {
      status: 413,
      error: `Upload request too large: maximum is ${(MAX_DOCUMENT_UPLOAD_REQUEST_SIZE / 1_000_000).toFixed(1)} MB including multipart overhead.`,
    };
  }

  return null;
}
