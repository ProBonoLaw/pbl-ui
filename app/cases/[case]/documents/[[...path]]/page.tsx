'use client';
import { logger } from '@/lib/logger';

import CasePageTemplate from '@/components/cases/CasePageTemplate';
import FolderOperations from './_components/FolderOperations';
import { FileDropUpload } from '@/components/FileDropUpload';
import { useAuth } from '@/hooks/useAuth';
import {
  parseSharePointResponse,
  type SharePointFile,
  type SharePointFolder,
} from '@/lib/types';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import FileViewer from './_components/FileViewer';
import FileExplorer from './_components/FileExplorer';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';

type DocumentAccess = {
  role: 'CONTRIBUTOR' | 'VIEW-ONLY';
  canCreateFolders: boolean;
  canRenameFolders: boolean;
  canDeleteFolders: boolean;
  canUploadFiles: boolean;
  canDeleteFiles: boolean;
};

const CONTRIBUTOR_DOCUMENT_ACCESS: DocumentAccess = {
  role: 'CONTRIBUTOR',
  canCreateFolders: true,
  canRenameFolders: true,
  canDeleteFolders: true,
  canUploadFiles: true,
  canDeleteFiles: true,
};

const VIEWER_DOCUMENT_ACCESS: DocumentAccess = {
  role: 'VIEW-ONLY',
  canCreateFolders: false,
  canRenameFolders: false,
  canDeleteFolders: false,
  canUploadFiles: false,
  canDeleteFiles: false,
};

function getDefaultDocumentAccess(role?: 'CONTRIBUTOR' | 'VIEW-ONLY') {
  return role === 'VIEW-ONLY'
    ? VIEWER_DOCUMENT_ACCESS
    : CONTRIBUTOR_DOCUMENT_ACCESS;
}
function getDocumentsFolderApiUrl(caseId: string, requestPath?: string | null) {
  const normalizedPath = (requestPath ?? '').replace(/^\/+|\/+$/g, '');

  return normalizedPath
    ? `/api/accounts/cases/${caseId}/documents/${normalizedPath}`
    : `/api/accounts/cases/${caseId}/documents`;
}

export default function CasePage({
  params,
}: {
  readonly params: Promise<{ case: string; path: string[] }>;
}) {
  const { fetchWithAuth, getToken } = useAuth();
  const [caseId, setCaseId] = useState<string | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [requestPath, setRequestPath] = useState<string | null>(null);
  const [files, setFiles] = useState<SharePointFile[] | null>(null);
  const [folders, setFolders] = useState<SharePointFolder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [fileInViewer, setFileInViewer] = useState<string | null>(null);
  const [viewerActive, setViewerActive] = useState<boolean>(false);
  const [documentsDrawerOpen, setDocumentsDrawerOpen] = useState(false);
  const [uploadToken, setUploadToken] = useState<string | null>(null);
  const [documentAccess, setDocumentAccess] = useState<DocumentAccess>(
    CONTRIBUTOR_DOCUMENT_ACCESS,
  );
  const [refreshFileRequest, setRefreshFileRequest] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      const { case: caseId, path } = await params;
      setCaseId(caseId);
      setPath(path ?? []);
      if (path) {
        const newPath = path?.map((segment, index) =>
          index === 0 && segment?.toLowerCase() === 'root' ? '' : segment,
        );
        const requestPath = newPath
          ?.filter((segment) => segment !== '')
          .join('/');
        setRequestPath(requestPath);
      } else {
        setRequestPath('');
      }
    })();
  }, [params]);

  useEffect(() => {
    if (!caseId || requestPath === null || refreshFileRequest === false) {
      logger.warn('Missing caseId or requestPath, cannot fetch documents.');
      return;
    }

    const ac = new AbortController();
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        logger.debug('Fetching protected document data...');
        const res = await fetchWithAuth(
          getDocumentsFolderApiUrl(caseId, requestPath),
          {
            method: 'GET',
            cache: 'no-store',
            signal: ac.signal,
          },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const message =
            body && typeof body.error === 'string'
              ? body.error
              : res.statusText;
          throw new Error(`${message} (${res.status})`);
        }
        const json = await res.json();
        const sharePointResponse = parseSharePointResponse(json);
        setFiles(sharePointResponse.d.Files.results);
        const filteredFolders = sharePointResponse.d.Folders.results.filter(
          (folder) =>
            folder.Name !== 'Forms' && folder.Name !== '_GeneratedDocuments',
        );
        setFolders(filteredFolders);
        setDocumentAccess(
          sharePointResponse.documentAccess ??
          getDefaultDocumentAccess(sharePointResponse.documentAccessRole),
        );
        setIsLoading(false);
        setRefreshFileRequest(false);
      } catch (e: unknown) {
        const error = e as Error;
        if (error.name !== 'AbortError') {
          setError(error.message ?? 'Request failed');
          setIsLoading(false);
          logger.error(
            'Error fetching document data:',
            error.message ?? 'Request failed',
          );
        }
      }
    })();
  }, [caseId, requestPath, refreshFileRequest, fetchWithAuth]);

  useEffect(() => {
    (async () => {
      const token = await getToken(
        process.env.NEXT_PUBLIC_AAD_API_SCOPE!.split(','),
      );
      setUploadToken(token);
    })();
  }, [embedUrl, fileInViewer, getToken]);

  const currentPath = ['cases', caseId!, 'documents', ...path];

  const searchParams = useSearchParams();
  useEffect(() => {
    setDocumentsDrawerOpen(false);
  }, [requestPath]);

  useEffect(() => {
    if (!isLoading && files && folders) {
      const file = searchParams.get('file');
      const fileInList = files.find((f) => f.Name === file);
      if (!fileInList) {
        setViewerActive(false);
        return;
      }

      if (file) {
        logger.debug('Opening file in viewer:', fileInList);
        setEmbedUrl(fileInList.ServerRelativeUrl);
        setFileInViewer(Array.isArray(file) ? file[0] : file);
        setViewerActive(true);
      }
    }
  }, [searchParams, fileInViewer, isLoading, files, folders]);

  function handleFileDeleted(filename: string) {
    // Refresh file list after deletion
    const updatedFiles =
      files?.filter((file) => file.Name !== filename) || null;
    setFiles(updatedFiles);
  }

  return (
    <CasePageTemplate
      params={params}
      isLoading={isLoading}
      title="Case Documents"
      showBreadcrumbs={true}
      currentPath={currentPath}
      contentClassName={viewerActive ? 'h-full min-h-0 overflow-hidden' : undefined}
      contentScrollable={!viewerActive}
      actionSection={
        !viewerActive ? (
          <button
            type="button"
            onClick={() => setDocumentsDrawerOpen(true)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800">
            Folder Controls
          </button>
        ) : undefined
      }>
      {error && <div className="error">{error}</div>}
      {viewerActive ? (
        <div className="h-full min-h-0 md:pt-4">
          {embedUrl && (
            <FileViewer
              caseId={caseId!}
              fileInViewer={fileInViewer!}
              setViewerActive={setViewerActive}
              requestPath={requestPath!}
              path={path}
              embedUrl={embedUrl}
              handleFileDeleted={handleFileDeleted}
              documentAccess={documentAccess}
            />
          )}
        </div>
      ) : (
        <div className="overflow-x-hidden">
          <div className="rounded-md border border-gray-200 dark:border-white/10">
            <div className="overflow-x-auto">
              <FileExplorer
                currentPath={currentPath}
                files={files || []}
                folders={folders || []}
                path={path}
              />
            </div>
          </div>
        </div>
      )}
      <Dialog
        open={documentsDrawerOpen && !viewerActive}
        onClose={setDocumentsDrawerOpen}
        className="relative z-50">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-gray-500/75 transition-opacity duration-500 ease-in-out data-closed:opacity-0 dark:bg-gray-900/50"
        />
        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <DialogPanel
                data-slot="folder-controls-panel"
                transition
                className="pointer-events-auto w-screen max-w-md transform transition duration-500 ease-in-out data-closed:translate-x-full sm:duration-700">
                <div className="flex h-full flex-col overflow-y-auto bg-white py-6 shadow-xl dark:bg-gray-800">
                  <div className="flex items-start justify-between px-4 sm:px-6">
                    <DialogTitle className="text-base font-semibold text-gray-900 dark:text-white">
                      Folder Controls
                    </DialogTitle>
                    <button
                      type="button"
                      onClick={() => setDocumentsDrawerOpen(false)}
                      aria-label="Close Folder Controls"
                      className="rounded-md text-gray-500 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-gray-300 dark:hover:text-white">
                      <XMarkIcon aria-hidden="true" className="size-6" />
                    </button>
                  </div>
                  <div className="mt-6 flex-1 space-y-6 px-4 sm:px-6">
                    <section>
                      <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                        Folder options
                      </h3>
                      <FolderOperations
                        caseId={caseId!}
                        path={path}
                        documentAccess={documentAccess}
                        refresh={() => {
                          if (refreshFileRequest) return;
                          setDocumentsDrawerOpen(false);
                          setRefreshFileRequest(true);
                          setIsLoading(true);
                        }}
                      />
                    </section>
                    {documentAccess.canUploadFiles && (
                      <section>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                          Upload files
                        </h3>
                        <FileDropUpload
                          action={getDocumentsFolderApiUrl(caseId!, requestPath)}
                          fieldName="file"
                          accept="image/*,.pdf,.docx,.txt,.md,.xlsx,.pptx,.mp4,.mov,.m4v,.avi,.mkv,.wmv,.webm,.aac,.aiff,.amr,.flac,.m4a,.mp3,.ogg,.opus,.wav,.wma"
                          multiple
                          maxSizeBytes={250 * 1_000_000}
                          headers={{ Authorization: 'Bearer ' + uploadToken }}
                          onComplete={() => {
                            setDocumentsDrawerOpen(false);
                            setRefreshFileRequest(true);
                            setIsLoading(true);
                          }}
                        />
                      </section>
                    )}
                  </div>
                </div>
              </DialogPanel>
            </div>
          </div>
        </div>
      </Dialog>
    </CasePageTemplate>
  );
}
