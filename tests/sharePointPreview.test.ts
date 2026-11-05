import test from 'node:test';
import assert from 'node:assert/strict';
import { getSharePointPreviewItemUrl } from '../lib/sharePointPreview.ts';

const caseId = '00000000-0000-4000-8000-000000001000';
const host = 'sharepoint.example.test';

test('resolves case document paths and absolute URLs through the documents drive', () => {
  for (const source of [
    `/sites/${caseId}/Shared Documents/Exhibit A.pdf`,
    `https://${host}/sites/${caseId}/Shared%20Documents/Exhibit%20A.pdf`,
  ]) {
    assert.equal(
      getSharePointPreviewItemUrl(source, caseId, host, 'drive-id'),
      'https://graph.microsoft.com/v1.0/drives/drive-id/root:/Exhibit%20A.pdf',
    );
  }
});

test('resolves case sharing URLs through Graph shares', () => {
  const source = `https://${host}/:b:/s/${caseId}/sharing-token`;
  const shareId = `u!${Buffer.from(source).toString('base64url')}`;
  assert.equal(
    getSharePointPreviewItemUrl(source, caseId, host, 'drive-id'),
    `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem`,
  );
});

test('preserves hash and percent characters in raw server-relative paths', () => {
  for (const [itemPath, encodedPath] of [
    ['Folder#1/Exhibit#1.pdf', 'Folder%231/Exhibit%231.pdf'],
    ['Exhibit 100%.pdf', 'Exhibit%20100%25.pdf'],
    ['Exhibit%20A.pdf', 'Exhibit%2520A.pdf'],
  ]) {
    assert.equal(
      getSharePointPreviewItemUrl(
        `/sites/${caseId}/Shared Documents/${itemPath}`, caseId, host, 'drive-id',
      ),
      `https://graph.microsoft.com/v1.0/drives/drive-id/root:/${encodedPath}`,
    );
  }
});

test('rejects source URLs outside the configured host and current case', () => {
  for (const source of [
    `https://example.com/sites/${caseId}/Shared Documents/Exhibit.pdf`,
    `https://${host}/:b:/s/other-case/sharing-token`,
    '/sites/other-case/Shared Documents/Exhibit.pdf',
    `/sites/${caseId}/Shared Documents/../Other/file.pdf`,
    `/sites/${caseId}/Shared Documents/Folder/../../file.pdf`,
    `/sites/${caseId}/Shared Documents/Folder\\..\\file.pdf`,
    `//example.com/sites/${caseId}/Shared Documents/Exhibit.pdf`,
    `https://${host}/sites/${caseId}/Shared%20Documents/../Other/file.pdf`,
    'javascript:alert(1)',
  ]) {
    assert.equal(getSharePointPreviewItemUrl(source, caseId, host, 'drive-id'), null);
  }
});
