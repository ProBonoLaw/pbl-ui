'use client';
import { Buffer } from 'buffer';
import { logger } from "@/lib/logger";
import CasePageTemplate from '@/components/cases/CasePageTemplate';
import ExhibitViewer from '@/components/ExhibitViewer';
import { useAuth } from '@/hooks/useAuth';
import {
  parseRequestData,
  parseSharePointFileResponse,
  parseSharePointResponse,
  RequestData,
  SharePointFile,
} from '@/lib/types';
import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AiOutputNotice from '@/components/AiOutputNotice';

const exhibitNumberRegex = /Exhibit\s+([0-9]*)/i;
function extractExhibitNumber(fileName: string): number | null {
  const match = fileName.match(exhibitNumberRegex);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

function orderExhibits(a: { name: string }, b: { name: string }): number {
  const numA = extractExhibitNumber(a.name) || 0;
  const numB = extractExhibitNumber(b.name) || 0;
  return numA - numB;
}

function getDeclarationIdFromSourceUrl(sourceUrl?: string | null) {
  if (!sourceUrl) {
    return null;
  }

  const getFromPath = (path: string) => {
    const segments = path
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .filter(Boolean);
    const generatedDocumentsIndex = segments.findIndex(
      (segment) => segment === '_GeneratedDocuments',
    );

    if (
      generatedDocumentsIndex !== -1 &&
      segments[generatedDocumentsIndex + 1]
    ) {
      return segments[generatedDocumentsIndex + 1];
    }

    return segments.at(-1) ?? null;
  };

  try {
    return getFromPath(new URL(sourceUrl).pathname);
  } catch {
    return getFromPath(sourceUrl.split(/[?#]/, 1)[0]);
  }
}

export default function EditCasePage({
  params,
}: {
  params: Promise<{ case: string; requestId: string }>;
}) {
  const { fetchWithAuth } = useAuth();
  const [requestId, setRequestId] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [declarationFile, setDeclarationFile] = useState<SharePointFile | null>(
    null,
  );
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [requestData, setRequestData] = useState<RequestData | null>(null);
  const [declarationId, setDeclarationId] = useState<string | null>(null);
  const [exhibitFiles, setExhibitFiles] = useState<{
    [filename: string]: SharePointFile;
  } | null>(null);
  const [baseHost, setBaseHost] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { case: caseId, requestId } = await params;
      logger.info('Case ID from params:', caseId);
      logger.info('Request ID from params:', requestId);
      setCaseId(caseId);
      setRequestId(requestId);
    })();
  }, [params]);

  useEffect(() => {
    if (!requestId) {
      logger.info('No request ID available yet.');
      return;
    }

    (async () => {
      try {
        if (!caseId) {
          logger.info('No case ID available yet.');
          return;
        }
        logger.info('Fetching request data for requestId:', requestId);
        const res = await fetchWithAuth(
          `/api/accounts/cases/${caseId}/requests/${requestId}`,
          {
            method: 'GET',
          },
        );
        if (!res.ok) {
          throw new Error(`${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        logger.info('Fetched request data:', json);
        const requestData = parseRequestData(json);
        setRequestData(requestData);
        const declarationId = getDeclarationIdFromSourceUrl(
          requestData?.sourceUrl,
        );
        if (!declarationId) {
          logger.info('No declarationId found in request data.');
          return;
        }
        setDeclarationId(declarationId);
      } catch (e: unknown) {
        const error = e as Error;
        logger.error(
          'Error fetching request data:',
          error.message ?? 'Request failed',
        );
      }
    })();
  }, [requestId, caseId, fetchWithAuth]);

  useEffect(() => {
    if (!caseId || !declarationId) {
      logger.info('Missing caseId or declarationId, cannot fetch documents.');
      return;
    }

    const ac = new AbortController();

    (async () => {
      try {
        logger.info('Fetching protected document data...');
        const res = await fetchWithAuth(
          `/api/accounts/cases/${caseId}/documents/_GeneratedDocuments/${declarationId}`,
          {
            method: 'GET',
            cache: 'no-store',
            signal: ac.signal,
          },
        );
        if (!res.ok) {
          throw new Error(`${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        const sharePointResponse = parseSharePointResponse(json);
        logger.info('Fetched document data:', json);
        const exhibitFiles = sharePointResponse.d.Files.results.filter(
          (file) => !file.Name.includes('Declaration'),
        );
        const exhibitFileMap: { [filename: string]: SharePointFile } = {};
        exhibitFiles.forEach((file) => {
          exhibitFileMap[file.Name] = file;
        });
        setExhibitFiles(exhibitFileMap);
        setBaseHost(sharePointResponse.baseUrl!);
        const declarationFiles = sharePointResponse.d.Files.results.find(
          (file) => file.Name.includes('Declaration.md'),
        );
        if (declarationFiles) {
          setDeclarationFile(declarationFiles);
        }
      } catch (e: unknown) {
        const error = e as Error;
        if (error.name !== 'AbortError')
          logger.error(
            'Error fetching document data:',
            error.message ?? 'Request failed',
          );
      }
    })();
  }, [fetchWithAuth, caseId, declarationId]);

  async function fetchFile(filename: string) {
    if (!filename || !caseId || !declarationId) {
      return null;
    }

    const res = await fetchWithAuth(
      `/api/accounts/cases/${caseId}/documents/_GeneratedDocuments/${declarationId}/${filename}?isFile=true`,
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
  }

  async function downloadFile(filename: string) {
    try {
      const fileBuffer = await fetchFile(filename);
      if (!fileBuffer) {
        logger.error('No content found for file:', filename);
        return;
      }

      const blob = new Blob([fileBuffer], {
        type: 'application/octet-stream',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      logger.error('Error downloading file:', error);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        if (declarationFile) {
          const declarationContentBuffer = await fetchFile(
            declarationFile.Name,
          );
          if (!declarationContentBuffer) {
            logger.error('No content found for declaration file.');
            return;
          }

          setFileContent(declarationContentBuffer.toString('utf-8'));
          setIsLoading(false);
        }
      } catch (e: unknown) {
        setError('Failed to load declaration content.');
        const error = e as Error;
        if (error.name !== 'AbortError')
          logger.error(
            'Error fetching document content:',
            error.message ?? 'Request failed',
          );
      }
    })();
  }, [declarationFile, caseId, declarationId, fetchWithAuth]);

  return (
    <CasePageTemplate
      title="Declaration"
      isLoading={isLoading}
      params={params}
      actionNotice={<AiOutputNotice />}>
      <div>
        <div className="text-xl font-semibold mt-8">Request: </div>
        <div className="ml-4 text-xl font-light">{requestData?.input}</div>
        <div className="text-xl font-semibold mt-8 ">Result</div>
        <div className="ml-4">
          {error && <p className="text-red-500">{error}</p>}
          {isLoading && <p>Loading...</p>}
          {!isLoading && (
            <>
              <div>
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1({ children, ...rest }) {
                      return (
                        <h1 className=" text-3xl underline mt-4" {...rest}>
                          {children}
                        </h1>
                      );
                    },
                    h2({ children, ...rest }) {
                      return (
                        <h2
                          className=" text-xl font-bold underline mt-4"
                          {...rest}>
                          {children}
                        </h2>
                      );
                    },
                    h3({ children, ...rest }) {
                      return (
                        <h3 className=" text-lg font-bold mt-2" {...rest}>
                          {children}
                        </h3>
                      );
                    },
                    p({ children, ...rest }) {
                      return (
                        <p className="my-2 ml-2" {...rest}>
                          {children}
                        </p>
                      );
                    },
                    ol({ children, ...rest }) {
                      return (
                        <ol className="list-decimal ml-8 my-2" {...rest}>
                          {children}
                        </ol>
                      );
                    },
                    code(props) {
                      const { children, ...rest } = props;
                      return <code {...rest}>{children}</code>;
                    },
                  }}>
                  {declarationFile ? fileContent : 'No content available'}
                </Markdown>
              </div>
              <div>
                <button
                  className="ml-4 bg-blue-500 text-white py-1 px-2 rounded hover:bg-blue-600 hover:text-gray-100 mb-2 mt-4"
                  onClick={() => {
                    downloadFile('Declaration.docx');
                  }}>
                  Download
                </button>
              </div>
            </>
          )}
        </div>
        <hr className="mt-4 mb-4" />
      </div>
      <div className="mb-12">
        <h1 className="text-2xl">Exhibits</h1>
        {requestData &&
          requestData.contents &&
          requestData.contents.length === 0 && <p>No exhibits found.</p>}
        {requestData &&
          exhibitFiles &&
          requestData.contents &&
          caseId &&
          baseHost &&
          requestData.contents
            .filter((content) => content.name.startsWith('Exhibit'))
            .sort(orderExhibits)
            .map((content, idx) => (
              <ExhibitViewer
                key={idx}
                exhibit={content}
                fileInfo={exhibitFiles[content.name]}
                caseId={caseId}
                baseHost={baseHost}
              />
            ))}
      </div>
    </CasePageTemplate>
  );
}
