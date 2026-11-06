import { Buffer } from 'buffer';
export function getSharePointPreviewItemUrl(
  source: string,
  caseId: string,
  sharePointHost: string,
  driveId: string,
) {
  const libraryPrefix = `/sites/${caseId}/Shared Documents/`;
  if (source.startsWith('/')) {
    if (
      !source.startsWith(libraryPrefix) ||
      source.includes('\\') ||
      source.split('/').some((segment) => segment === '.' || segment === '..')
    ) {
      return null;
    }
    const itemPath = source.slice(libraryPrefix.length);
    if (!itemPath) {
      return null;
    }
    const encodedPath = itemPath.split('/').map(encodeURIComponent).join('/');
    return `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:/${encodedPath}`;
  }
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(source, `https://${sharePointHost}`);
  } catch {
    return null;
  }

  if (
    sourceUrl.protocol !== 'https:' ||
    sourceUrl.host !== sharePointHost ||
    sourceUrl.username ||
    sourceUrl.password
  ) {
    return null;
  }

  let pathname: string;
  try {
    pathname = decodeURI(sourceUrl.pathname);
  } catch {
    return null;
  }

  const sharingPath = pathname.match(/^\/:[a-z]:\/s\/([^/]+)\/[^/]+$/i);
  if (sharingPath) {
    if (sharingPath[1] !== caseId) {
      return null;
    }
    const shareId = `u!${Buffer.from(sourceUrl.href).toString('base64url')}`;
    return `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem`;
  }

  if (!pathname.startsWith(libraryPrefix)) {
    return null;
  }
  const itemPath = pathname.slice(libraryPrefix.length);
  if (!itemPath) {
    return null;
  }
  const encodedPath = itemPath.split('/').map(encodeURIComponent).join('/');
  return `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:/${encodedPath}`;
}
