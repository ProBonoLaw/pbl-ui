export type FileIngestionRequest = {
  eventKind: 'FileIngestion';
  isFolder: false;
  identifier: string;
  accountId: string;
  highRes: false;
  force: true;
};

export function createFileIngestionRequest({
  identifier,
  accountId,
}: Pick<
  FileIngestionRequest,
  'identifier' | 'accountId'
>): FileIngestionRequest {
  return {
    eventKind: 'FileIngestion',
    isFolder: false,
    identifier,
    accountId,
    highRes: false,
    force: true,
  };
}
