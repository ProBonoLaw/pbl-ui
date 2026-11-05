import { SharePointFolder } from '@/lib/types';
import { FolderDown, FolderUp } from 'lucide-react';
import Link from 'next/link';

export default function FolderItem({
  folder,
  path,
}: {
  folder?: SharePointFolder;
  path: string[];
}) {
  const isBackButton = !folder;
  const folderName = folder?.Name || 'Back';
  const adjustedPath = [...path];
  if (!folder) {
    adjustedPath.pop();
  }

  const folderPath =
    `/${adjustedPath.join('/')}${adjustedPath.length > 0 ? '/' : ''}` +
    (folder ? folderName : '');

  return (
    <tr>
      <td className="p-0 md:p-4 m-2 dark:text-white content-center items-center self-center md:w-40 w-20 dark:hover:bg-gray-700 hover:bg-gray-200">
        <Link
          className="hover:underline text-center content-center items-center self-center flex flex-col"
          title={folderName}
          href={folderPath}>
          {isBackButton ? (
            <FolderUp className="w-10 md:w-18 h-10 md:h-18 p-2" />
          ) : (
            <FolderDown className="w-10 md:w-18 h-10 md:h-18 p-2" />
          )}
        </Link>
      </td>
      <td
        colSpan={2}
        className="px-2 content-center items-center self-center text-sm md:text-base xl:text-lg">
        <Link
          className="hover:underline flex flex-col"
          title={folderName}
          href={folderPath}>
          {folderName}
        </Link>
      </td>
    </tr>
  );
}
