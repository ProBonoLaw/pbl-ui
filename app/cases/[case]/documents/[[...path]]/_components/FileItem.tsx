import { SharePointFile } from '@/lib/types';
import { File } from 'lucide-react';

const MAX_FILENAME_LENGTH = 60;

function truncateFilenamePreservingExtension(
  filename: string,
  maxLength: number = MAX_FILENAME_LENGTH,
) {
  if (filename.length <= maxLength) {
    return filename;
  }

  const lastDotIndex = filename.lastIndexOf('.');
  const hasExtension = lastDotIndex > 0 && lastDotIndex < filename.length - 1;

  if (!hasExtension) {
    return `${filename.slice(0, maxLength - 3)}...`;
  }

  const extension = filename.slice(lastDotIndex);
  const filenameStemMaxLength = maxLength - extension.length - 3;

  if (filenameStemMaxLength <= 0) {
    return `...${extension}`;
  }

  return `${filename.slice(0, filenameStemMaxLength)}...${extension}`;
}

export default function FileItem({
  file,
  onRequest,
}: {
  file: SharePointFile;
  onRequest: (url: string, filename: string) => void;
}) {
  const handleRequest = async () => {
    onRequest(file.ServerRelativeUrl!, file.Name);
  };

  return (
    <tr>
      <td className="dark:text-white content-center items-center self-center md:w-40 w-20 dark:hover:bg-gray-700 hover:bg-gray-200">
        <button
          onClick={handleRequest}
          className="hover:underline text-center content-center items-center self-center flex flex-col w-full"
          title={file.Name}>
          <File className="w-10 md:w-18 h-10 md:h-18 p-2" />
        </button>
      </td>
      <td className="px-2 py-1 text-sm md:text-base xl:text-lg">
        <button
          onClick={handleRequest}
          className="hover:underline flex flex-col w-full text-left"
          title={file.Name}>
          {truncateFilenamePreservingExtension(file.Name)}
        </button>
      </td>
      <td className="px-2 py-1 content-center items-center self-center text-xs md:text-base xl:text-lg">
        {file.TimeCreated.toLocaleString()}
      </td>
    </tr>
  );
}
