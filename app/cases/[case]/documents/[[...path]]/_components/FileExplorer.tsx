import FileItem from '@/app/cases/[case]/documents/[[...path]]/_components/FileItem';
import FolderItem from '@/app/cases/[case]/documents/[[...path]]/_components/FolderItem';
import { SharePointFile, SharePointFolder } from '@/lib/types';
import { ChevronDownIcon, ChevronUpIcon, DotIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DataTableSurface from '@/components/tables/DataTableSurface';

const FileExplorer = ({
  currentPath,
  files,
  folders,
  path,
}: {
  currentPath: string[];
  files: SharePointFile[];
  folders: SharePointFolder[];
  path: string[];
}) => {
  const { push: routerPush } = useRouter();
  const [orderedFiles, setOrderedFiles] = useState<SharePointFile[] | null>(
    null,
  );
  const [orderedFolders, setOrderedFolders] = useState<
    SharePointFolder[] | null
  >(null);

  const [sortDate, setSortDate] = useState<'asc' | 'desc' | undefined>(
    undefined,
  );
  const [sortFilename, setSortFilename] = useState<'asc' | 'desc' | undefined>(
    undefined,
  );

  const toggleSortDate = () => {
    setSortFilename(undefined);
    if (sortDate === 'asc') {
      setSortDate('desc');
    } else if (sortDate === 'desc') {
      setSortDate(undefined);
    } else {
      setSortDate('asc');
    }
  };

  const toggleSortFilename = () => {
    setSortDate(undefined);
    if (sortFilename === 'asc') {
      setSortFilename('desc');
    } else if (sortFilename === 'desc') {
      setSortFilename(undefined);
    } else {
      setSortFilename('asc');
    }
  };

  useEffect(() => {
    if (!files) {
      return;
    }

    const sortedFiles = [...files];
    const filteredFolders = [...folders!];

    if (sortFilename) {
      sortedFiles.sort((a, b) => {
        return sortFilename === 'asc'
          ? a.Name.localeCompare(b.Name)
          : b.Name.localeCompare(a.Name);
      });
      filteredFolders.sort((a, b) => {
        return sortFilename === 'asc'
          ? a.Name.localeCompare(b.Name)
          : b.Name.localeCompare(a.Name);
      });
    }
    if (sortDate) {
      sortedFiles.sort((a, b) => {
        if (sortDate === 'asc') {
          return a.TimeCreated.getTime() - b.TimeCreated.getTime();
        } else {
          return b.TimeCreated.getTime() - a.TimeCreated.getTime();
        }
      });
    }

    setOrderedFiles(sortedFiles);
    setOrderedFolders(filteredFolders);
  }, [sortDate, sortFilename, files, folders]);
  return (
    <DataTableSurface>
      <thead>
        <tr>
          <th
            scope="col"
            className="py-3.5 md:pr-3 md:pl-4 text-left text-sm font-semibold text-gray-900 sm:pl-0 dark:text-white"></th>
          <th
            scope="col"
            aria-sort={sortFilename === 'asc' ? 'ascending' : sortFilename === 'desc' ? 'descending' : 'none'}
            className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
            <button type="button" onClick={toggleSortFilename} className="group inline-flex cursor-pointer focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-blue-600">
              Filename
              <span className="ml-2 flex-none rounded-sm bg-gray-100 text-gray-900 group-hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:group-hover:bg-gray-700">
                {sortFilename === 'asc' && (
                  <ChevronUpIcon aria-hidden="true" className="size-5" />
                )}
                {sortFilename === 'desc' && (
                  <ChevronDownIcon aria-hidden="true" className="size-5" />
                )}
                {sortFilename === undefined && (
                  <DotIcon aria-hidden="true" className="size-5" />
                )}
              </span>
            </button>
          </th>
          <th
            scope="col"
            aria-sort={sortDate === 'asc' ? 'ascending' : sortDate === 'desc' ? 'descending' : 'none'}
            className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
            <button type="button" onClick={toggleSortDate} className="group inline-flex cursor-pointer focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-blue-600">
              Date
              <span className="ml-2 flex-none rounded-sm bg-gray-100 text-gray-900 group-hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:group-hover:bg-gray-700">
                {sortDate === 'asc' && (
                  <ChevronUpIcon aria-hidden="true" className="size-5" />
                )}
                {sortDate === 'desc' && (
                  <ChevronDownIcon aria-hidden="true" className="size-5" />
                )}
                {sortDate === undefined && (
                  <DotIcon aria-hidden="true" className="size-5" />
                )}
              </span>
            </button>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 dark:divide-white/15 bg-white dark:bg-gray-900">
        {orderedFiles?.length === 0 && orderedFolders?.length === 0 && path.length === 0 && (
          <tr><td colSpan={3}>No files or folders found.</td></tr>
        )}
        {orderedFiles && orderedFiles.length > 0 ? (
          <>
            {orderedFiles.map((file) => (
              <FileItem
                key={file.ListItemAllFields.Id}
                file={file}
                onRequest={(url, filename) => {
                  routerPush(`?file=${filename}`);
                }}
              />
            ))}
          </>
        ) : (
          <></>
        )}
        {orderedFolders && orderedFolders.length > 0 ? (
          <>
            {orderedFolders.map((folder, index) => (
              <FolderItem
                key={'folder_' + index}
                folder={folder}
                path={currentPath}
              />
            ))}
          </>
        ) : (
          <></>
        )}
        {path.length !== 0 ? <FolderItem path={currentPath} /> : null}
      </tbody>
    </DataTableSurface>
  );
};

export default FileExplorer;
