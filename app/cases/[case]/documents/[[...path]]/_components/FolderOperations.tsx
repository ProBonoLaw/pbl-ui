'use client';
import { logger } from '@/lib/logger';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ModalDialog from '../../../../../../components/ModalDialog';
import ConfirmationDialog from '../../../../../../components/ConfirmationDialog';

type DocumentAccess = {
  canCreateFolders: boolean;
  canRenameFolders: boolean;
  canDeleteFolders: boolean;
};

function normalizeDocumentPath(path?: string[]) {
  return (
    path
      ?.map((segment, index) =>
        index === 0 && segment?.toLowerCase() === 'root' ? '' : segment,
      )
      .filter((segment) => segment !== '') ?? []
  );
}
function getDocumentsFolderApiUrl(caseId: string, requestPath?: string | null) {
  const normalizedPath = (requestPath ?? '').replace(/^\/+|\/+$/g, '');

  return normalizedPath
    ? `/api/accounts/cases/${caseId}/documents/${normalizedPath}`
    : `/api/accounts/cases/${caseId}/documents`;
}

export default function FolderOperations({
  caseId,
  path,
  refresh,
  documentAccess,
}: {
  caseId?: string;
  path?: string[];
  refresh: () => void;
  documentAccess: DocumentAccess;
}) {
  const { fetchWithAuth } = useAuth();
  const [requestPath, setRequestPath] = useState<string | null>(null);
  const [createFolderName, setCreateFolderName] = useState<string>('');
  const [renameFolderName, setRenameFolderName] = useState<string>('');
  const [activeDialog, setActiveDialog] = useState<'create' | 'rename' | 'delete' | null>(null);
  const { push: routerPush } = useRouter();
  const normalizedPath = normalizeDocumentPath(path);

  useEffect(() => {
    setRequestPath(normalizeDocumentPath(path).join('/'));
  }, [path]);

  const handleRefresh = () => {
    refresh();
    setActiveDialog(null);
  };

  const handleCreateFolder = async () => {
    if (!caseId || !createFolderName) {
      logger.error('Cannot create folder: missing caseId or createFolderName', {
        caseId,
        createFolderName,
      });
      return;
    }

    const res = await fetchWithAuth(
      getDocumentsFolderApiUrl(caseId, requestPath),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({ folderName: createFolderName }),
      },
    );

    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }

    logger.info('Folder created successfully:', createFolderName);
    setCreateFolderName('');
    handleRefresh();
  };

  const handleRenameFolder = async () => {
    if (!caseId || !renameFolderName || !path || path.length === 0) {
      logger.error(
        'Cannot rename folder: missing caseId, renameFolderName, or invalid path',
        { caseId, renameFolderName, path },
      );
      return;
    }

    const res = await fetchWithAuth(
      getDocumentsFolderApiUrl(caseId, requestPath),
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({ folderName: renameFolderName }),
      },
    );

    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }

    const parentPath = path.length > 1 ? path.slice(0, -1).join('/') : '';
    routerPush(`/cases/${caseId}/documents/${parentPath}/${renameFolderName}`);
  };

  const handleDeleteFolder = async () => {
    if (!caseId || !path || path.length === 0) {
      logger.error('Cannot delete folder: missing caseId or invalid path', {
        caseId,
        path,
      });
      return;
    }

    const res = await fetchWithAuth(
      getDocumentsFolderApiUrl(caseId, requestPath),
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
    );

    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }

    const parentPath = path.length > 1 ? path.slice(0, -1).join('/') : '';
    routerPush(`/cases/${caseId}/documents/${parentPath}`);
  };

  const actionClassName =
    'rounded-md px-4 py-2 text-left text-sm font-semibold text-white shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';

  return (
    <>
      {activeDialog === 'create' && (
        <ModalDialog
          opened={true}
          onApproved={handleCreateFolder}
          onCanceled={() => {
            setCreateFolderName('');
            setActiveDialog(null);
          }}
          title="Create New Folder">
          <label>
            To create a new folder, please provide a name and confirm your action.
          </label>
          <input
            type="text"
            placeholder="Folder Name"
            className="mt-2 block w-full rounded-md border border-gray-300 p-2"
            onChange={(event) => setCreateFolderName(event.target.value)}
          />
        </ModalDialog>
      )}
      {activeDialog === 'rename' && (
        <ModalDialog
          opened={true}
          onApproved={() => {
            setActiveDialog(null);
            setRenameFolderName('');
            void handleRenameFolder().catch((error) => {
              logger.error('Failed to rename folder:', error);
            });
          }}
          onCanceled={() => {
            setRenameFolderName('');
            setActiveDialog(null);
          }}
          title="Rename Folder">
          <label>
            To rename the folder, please provide a new name and confirm your action.
          </label>
          <input
            type="text"
            placeholder="New Folder Name"
            className="mt-2 block w-full rounded-md border border-gray-300 p-2"
            onChange={(event) => setRenameFolderName(event.target.value)}
          />
        </ModalDialog>
      )}
      {activeDialog === 'delete' && (
        <ConfirmationDialog
          defaultOpen={true}
          description="To delete this folder, please confirm your action. This action cannot be undone."
          confirmButtonText="Delete"
          cancelButtonText="Cancel"
          onClose={(confirmed) => {
            setActiveDialog(null);
            if (confirmed) void handleDeleteFolder();
          }}
          title="Delete Folder"
        />
      )}
      <div className="grid gap-2">
        {documentAccess.canCreateFolders && (
          <button type="button" onClick={() => setActiveDialog('create')} className={`${actionClassName} bg-green-700 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-500`}>
            Create New Folder
          </button>
        )}
        {documentAccess.canRenameFolders && normalizedPath.length > 0 && normalizedPath[0] !== 'Emails' && (
          <button type="button" onClick={() => setActiveDialog('rename')} className={`${actionClassName} bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400`}>
            Rename Folder
          </button>
        )}
        <button type="button" onClick={handleRefresh} className={`${actionClassName} bg-slate-600 hover:bg-slate-500 dark:bg-slate-500 dark:hover:bg-slate-400`}>
          Refresh Folder
        </button>
        {documentAccess.canDeleteFolders && normalizedPath.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveDialog('delete')}
            className={`${actionClassName} bg-red-600 hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400`}>
            Delete Folder
          </button>
        )}
      </div>
    </>
  );
}
