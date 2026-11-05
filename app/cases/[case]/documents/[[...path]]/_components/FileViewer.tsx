import { Buffer } from 'buffer';
import { logger } from '@/lib/logger';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProxiedIFrame from '@/components/ProxiedIFrame';
import { useAuth } from '@/hooks/useAuth';
import { parseSharePointFileResponse } from '@/lib/types';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';

type DocumentAccess = {
  canDeleteFiles: boolean;
};

const FileViewer = ({
  caseId,
  fileInViewer,
  setViewerActive,
  requestPath,
  path,
  embedUrl,
  handleFileDeleted,
  documentAccess,
}: {
  caseId: string;
  fileInViewer: string;
  setViewerActive: React.Dispatch<React.SetStateAction<boolean>>;
  requestPath: string;
  path: string[];
  embedUrl: string;
  handleFileDeleted?: (filename: string) => void;
  documentAccess: DocumentAccess;
}) => {
  const { push: routerPush } = useRouter();
  const { fetchWithAuth } = useAuth();
  const documentsUrl = `/cases/${caseId}/documents/${path.join('/')}`;
  const deleteFile = async (filename: string) => {
    if (!caseId) {
      return;
    }

    const url = `/api/accounts/cases/${caseId}/documents/${requestPath}/${filename}?isFile=true`;
    const res = await fetchWithAuth(url, {
      method: 'DELETE',
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }
  };

  const fetchFile = async (filename: string) => {
    if (!filename || !caseId) {
      return null;
    }

    const res = await fetchWithAuth(
      `/api/accounts/cases/${caseId}/documents/${requestPath}/${filename}?isFile=true`,
      {
        method: 'GET',
        cache: 'no-store',
      },
    );

    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }

    const content = await res.json();
    const fileData = parseSharePointFileResponse(content);
    const base64Content = fileData.content;
    if (base64Content) {
      return Buffer.from(base64Content, 'base64');
    }

    return null;
  };

  const downloadEmbeddedDocument = async () => {
    if (!embedUrl || !caseId || !fileInViewer) {
      return;
    }

    try {
      const fileBuffer = await fetchFile(fileInViewer);
      if (!fileBuffer) {
        logger.error('Failed to fetch file for download.');
        return;
      }

      // Create a blob and trigger download
      const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileInViewer;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Error downloading embedded document:', error);
    }
  };

  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  return (
    <>
      <ConfirmationDialog
        title="Confirm Delete"
        description={`Are you sure you want to delete ${fileInViewer}?`}
        confirmButtonText="Delete"
        cancelButtonText="Cancel"
        defaultOpen={deleteDialogOpen}
        onClose={async (confirmed) => {
          setDeleteDialogOpen(false);
          logger.info('Delete confirmation result:', confirmed);
          if (confirmed) {
            await deleteFile(fileInViewer!);
            routerPush(documentsUrl);
            handleFileDeleted?.(fileInViewer!);
            setViewerActive(false);
            return;
          }
          routerPush(documentsUrl);
          setViewerActive(false);
        }}
      />
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-2 flex shrink-0 items-start justify-between gap-3">
          <h2 className="min-w-0 break-words text-xl font-bold">{fileInViewer}</h2>
          <button
            type="button"
            onClick={() => setActionsOpen(true)}
            className="shrink-0 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800">
            File actions
          </button>
        </div>
        <ProxiedIFrame src={embedUrl} caseId={caseId} fillHeight />
      </div>
      <Dialog open={actionsOpen} onClose={setActionsOpen} className="relative z-50">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-gray-500/75 transition-opacity duration-500 ease-in-out data-closed:opacity-0 dark:bg-gray-900/50"
        />
        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <DialogPanel
                data-slot="file-actions-panel"
                transition
                className="pointer-events-auto w-screen max-w-md transform transition duration-500 ease-in-out data-closed:translate-x-full sm:duration-700">
                <div className="flex h-full flex-col overflow-y-auto bg-white py-6 shadow-xl dark:bg-gray-800">
                  <div className="flex items-start justify-between px-4 sm:px-6">
                    <DialogTitle className="text-base font-semibold text-gray-900 dark:text-white">
                      File actions
                    </DialogTitle>
                    <button
                      type="button"
                      onClick={() => setActionsOpen(false)}
                      aria-label="Close file actions"
                      className="rounded-md text-gray-500 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-gray-300 dark:hover:text-white">
                      <XMarkIcon aria-hidden="true" className="size-6" />
                    </button>
                  </div>
                  <div className="mt-6 flex flex-col gap-3 px-4 sm:px-6">
                    <button
                      type="button"
                      onClick={() => {
                        setActionsOpen(false);
                        void downloadEmbeddedDocument();
                      }}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActionsOpen(false);
                        routerPush(documentsUrl);
                        setViewerActive(false);
                      }}
                      className="rounded-md bg-gray-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-500">
                      Close
                    </button>
                    {documentAccess.canDeleteFiles && (
                      <button
                        type="button"
                        onClick={() => setDeleteDialogOpen(true)}
                        className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </DialogPanel>
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
};

export default FileViewer;
