import { logger } from '@/lib/logger';
import {
  internalServerErrorResponse,
  unauthorizedResponse,
} from '@/lib/apiResponses';
import { getCosmosContainer } from '@/lib/cosmos';
import {
  ArgumentBuilderOutput,
  QAInteractionSlim,
  QAInteractionSlimModel,
  parseArgumentBuilderOutput,
  parseRequestDataArray,
} from '@/lib/types';
import { requireUserCaseAccess, UserAccessError } from '@/lib/userAccess';
import { validateTokenOrNull } from '@/lib/validateToken';
import { SqlQuerySpec } from '@azure/cosmos';
import * as msal from '@azure/msal-node';
import { decodeJwt } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTrace } from '@/lib/apiTracing';
import { getSharePointReadScopes } from '@/lib/sharePointAccess';

const ARGUMENT_BUILDER_FORMATTING_TIMEOUT_MS = 45_000;
const RAW_REQUEST_OUTPUT_TIMEOUT_MS = 45_000;

class RawRequestOutputError extends Error {
  constructor(
    message: string,
    public readonly status = 502,
    public readonly upstreamStatus?: number,
    public readonly upstreamCode?: string,
  ) {
    super(message);
  }
}

function getSharePointErrorCode(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as {
      error?: { code?: unknown };
    };
    return typeof parsed.error?.code === 'string'
      ? parsed.error.code
      : undefined;
  } catch {
    return undefined;
  }
}

type RequestWithSharePointOutput = {
  sourceUrl?: string | null;
  rawOutputJson?: string | null;
};

function safeDecodeUri(value: string) {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

function getSharePointPath(value: string) {
  const withoutFragmentOrQuery = value.split(/[?#]/, 1)[0];
  try {
    return safeDecodeUri(new URL(value).pathname);
  } catch {
    return safeDecodeUri(withoutFragmentOrQuery);
  }
}

function joinSharePointPath(basePath: string, childPath: string) {
  const normalizedBase = basePath.replace(/\/+$/, '');
  const normalizedChild = childPath.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedChild}`;
}

function getRawOutputServerRelativeUrl(
  requestItem: RequestWithSharePointOutput,
  caseId: string,
) {
  if (!requestItem.rawOutputJson) {
    return null;
  }

  const rawOutputPath = getSharePointPath(requestItem.rawOutputJson);
  if (rawOutputPath.startsWith(`/sites/${caseId}/`)) {
    return rawOutputPath;
  }

  if (rawOutputPath.startsWith('/Shared Documents/')) {
    return `/sites/${caseId}${rawOutputPath}`;
  }

  if (rawOutputPath.startsWith('/sites/')) {
    return null;
  }

  if (!requestItem.sourceUrl) {
    return null;
  }

  const sourcePath = getSharePointPath(requestItem.sourceUrl);
  if (!sourcePath.startsWith(`/sites/${caseId}/`)) {
    return null;
  }

  return joinSharePointPath(sourcePath, rawOutputPath);
}

function encodeSharePointDecodedUrl(serverRelativeUrl: string) {
  return encodeURI(serverRelativeUrl).replace(/'/g, '%27');
}

async function getSharePointAccessToken(incoming: string) {
  const clientId = process.env.NEXT_PUBLIC_AAD_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const sharePointHost = process.env.SHAREPOINT_HOST;

  if (!clientId || !clientSecret || !sharePointHost) {
    throw new RawRequestOutputError(
      'Missing SharePoint token exchange configuration',
      500,
    );
  }

  const { tid } = decodeJwt(incoming) as { tid?: string };
  const tenantId = tid || process.env.NEXT_PUBLIC_AAD_TENANT_ID;
  if (!tenantId) {
    throw new RawRequestOutputError('Missing Azure tenant configuration', 500);
  }

  const authority = `https://login.microsoftonline.com/${tenantId}`;
  const cca = new msal.ConfidentialClientApplication({
    auth: { clientId, clientSecret, authority },
  });

  try {
    const tokenResp = await cca.acquireTokenOnBehalfOf({
      authority,
      scopes: getSharePointReadScopes(
        sharePointHost,
        process.env.AZURE_SHAREPOINT_READ_SCOPES ??
          process.env.AZURE_SHAREPOINT_READ_SCOPE,
      ),
      oboAssertion: incoming,
    });

    if (!tokenResp?.accessToken) {
      throw new RawRequestOutputError(
        'SharePoint token exchange returned no access token',
      );
    }

    return tokenResp.accessToken;
  } catch (error) {
    if (error instanceof RawRequestOutputError) {
      throw error;
    }

    logger.error('Request raw output SharePoint token exchange failed:', error);
    throw new RawRequestOutputError(
      'Unable to exchange credentials for SharePoint access',
    );
  }
}

async function fetchRawRequestOutput(
  requestItem: RequestWithSharePointOutput,
  incoming: string,
  caseId: string,
) {
  const serverRelativeUrl = getRawOutputServerRelativeUrl(requestItem, caseId);
  if (!serverRelativeUrl) {
    return null;
  }

  const sharePointHost = process.env.SHAREPOINT_HOST;
  if (!sharePointHost) {
    throw new RawRequestOutputError(
      'Missing SharePoint host configuration',
      500,
    );
  }

  const accessToken = await getSharePointAccessToken(incoming);
  const encodedServerRelativeUrl =
    encodeSharePointDecodedUrl(serverRelativeUrl);
  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    RAW_REQUEST_OUTPUT_TIMEOUT_MS,
  );

  let rawOutputText: string;
  try {
    const response = await fetchWithTrace(
      `https://${sharePointHost}/sites/${caseId}/_api/web/GetFileByServerRelativePath(decodedurl='${encodedServerRelativeUrl}')/$value`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json;odata=verbose',
        },
        signal: abortController.signal,
      },
    );

    if (!response.ok) {
      const responseBody = await response.text().catch(() => '');
      const upstreamCode = getSharePointErrorCode(responseBody);
      logger.error(
        'Failed to fetch request raw output from SharePoint:',
        response.status,
        response.statusText,
        upstreamCode ?? responseBody,
      );
      throw new RawRequestOutputError(
        'Failed to fetch request raw output',
        502,
        response.status,
        upstreamCode,
      );
    }

    rawOutputText = await response.text();
  } catch (error) {
    if (error instanceof RawRequestOutputError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      logger.error(
        'Request raw output fetch timed out after',
        RAW_REQUEST_OUTPUT_TIMEOUT_MS,
        'ms',
      );
      throw new RawRequestOutputError('Request raw output fetch timed out');
    }

    logger.error('Request raw output fetch failed:', error);
    throw new RawRequestOutputError('Failed to fetch request raw output');
  } finally {
    clearTimeout(timeout);
  }
  try {
    return JSON.parse(rawOutputText) as unknown;
  } catch (error) {
    logger.error('Request raw output JSON parse failed:', error);
    throw new RawRequestOutputError('Request raw output is not valid JSON');
  }
}

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/cases/[caseId]/requests/[requestId]'>,
) {
  const { caseId, requestId } = await ctx.params;

  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) {
    return unauthorizedResponse();
  }

  let payload: Awaited<ReturnType<typeof validateTokenOrNull>>;
  try {
    payload = await validateTokenOrNull(
      token,
      'GET /api/accounts/cases/[caseId]/requests/[requestId]',
    );
  } catch (error) {
    logger.error(
      'Token validation infrastructure failure during GET /api/accounts/cases/[caseId]/requests/[requestId]:',
      error,
    );
    return internalServerErrorResponse();
  }
  if (!payload) {
    return unauthorizedResponse('Invalid or missing token');
  }
  const oid = payload.oid as string;

  try {
    await requireUserCaseAccess(oid, caseId, {
      requireIsActive: true,
      allowInactiveGuestAccess: true,
    });
  } catch (error) {
    if (error instanceof UserAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    logger.error('Error authorizing request detail access:', error);
    return internalServerErrorResponse();
  }

  const requestsContainerName = process.env.COSMOS_SQL_REQUESTS_CONTAINER;
  if (!requestsContainerName) {
    logger.error(
      'Missing required COSMOS_SQL_REQUESTS_CONTAINER for GET /api/accounts/cases/[caseId]/requests/[requestId]',
    );
    return internalServerErrorResponse();
  }

  const container = getCosmosContainer(requestsContainerName);
  const querySpec: SqlQuerySpec = {
    query:
      'SELECT * from c WHERE c.accountId = @accountId AND c.id=@requestId AND c.oid = @oid',
    parameters: [
      { name: '@accountId', value: caseId },
      { name: '@requestId', value: requestId },
      { name: '@oid', value: oid },
    ],
  };

  const { resources: items } = await container.items
    .query(querySpec)
    .fetchAll();

  if (items.length === 0) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  const requestItems = parseRequestDataArray(items);
  const requestItem = requestItems[0];

  if (requestItem.type === 'timeline-builder') {
    try {
      await requireUserCaseAccess(oid, caseId, {
        requireIsActive: true,
        allowInactiveGuestAccess: true,
        requiredFeature: 'canGenerateDeclaration',
      });
    } catch (error) {
      if (error instanceof UserAccessError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status },
        );
      }

      logger.error('Error authorizing timeline detail access:', error);
      return internalServerErrorResponse();
    }
  }

  if (
    (requestItem.type === 'argument-builder' ||
      requestItem.type === 'timeline-builder') &&
    !requestItem.output &&
    requestItem.rawOutputJson
  ) {
    try {
      const rawOutput = await fetchRawRequestOutput(requestItem, token, caseId);

      if (rawOutput) {
        requestItem.output = rawOutput;
      }
    } catch (error) {
      if (error instanceof RawRequestOutputError) {
        logger.error('Request raw output unavailable:', error);
        return NextResponse.json(
          {
            error: 'Request output unavailable',
            reason: error.message,
            upstreamStatus: error.upstreamStatus,
            upstreamCode: error.upstreamCode,
          },
          { status: error.status },
        );
      }

      logger.error('Request raw output fetch threw error:', error);
      return internalServerErrorResponse();
    }
  }
  if (requestItem.type === 'argument-builder' && requestItem.output) {
    const formattingUrl = process.env.AIMIE_QA_FORMATTING_URL;
    const formattingKey = process.env.AIMIE_QA_KEY;

    if (!formattingUrl || !formattingKey) {
      logger.warn(
        'Argument builder formatting skipped: AIMIE formatting env vars missing',
      );
    } else {
      const parsedOutput = parseArgumentBuilderOutput(requestItem.output);

      const formatCombinedDocument = async (
        document: string,
        context: ArgumentBuilderOutput['context'],
      ): Promise<QAInteractionSlim | null> => {
        if (!document.trim()) {
          return null;
        }
        const abortController = new AbortController();
        const timeout = setTimeout(
          () => abortController.abort(),
          ARGUMENT_BUILDER_FORMATTING_TIMEOUT_MS,
        );

        try {
          const response = await fetchWithTrace(formattingUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Ocp-Apim-Subscription-Key': formattingKey,
            },
            body: JSON.stringify({
              document,
              context: context ?? [],
              accountId: caseId,
            }),
            signal: abortController.signal,
          });

          if (!response.ok) {
            const errorText = await response.text();
            logger.warn(
              'Argument builder formatting failed:',
              response.status,
              response.statusText,
              errorText,
            );
            return null;
          }

          const formattedPayload = await response.json();

          const parseSlim = (payload: unknown): QAInteractionSlim | null => {
            try {
              return QAInteractionSlimModel.parse(payload).data;
            } catch {
              return null;
            }
          };

          const primary = parseSlim(formattedPayload);
          if (primary) {
            return primary;
          }

          const nested = parseSlim(
            (formattedPayload as Record<string, unknown> | undefined)?.data,
          );
          if (nested) {
            return nested;
          }

          const plainDocument =
            typeof (formattedPayload as Record<string, unknown> | undefined)
              ?.document === 'string'
              ? (formattedPayload as Record<string, unknown>).document
              : typeof (
                    (formattedPayload as Record<string, unknown> | undefined)
                      ?.data as Record<string, unknown> | undefined
                  )?.document === 'string'
                ? (
                    (formattedPayload as Record<string, unknown>)
                      .data as Record<string, unknown>
                  ).document
                : null;

          if (plainDocument) {
            const exhibitsCandidate =
              (formattedPayload as Record<string, unknown> | undefined)
                ?.exhibits ??
              (
                (formattedPayload as Record<string, unknown> | undefined)
                  ?.data as Record<string, unknown> | undefined
              )?.exhibits ??
              [];

            const fallback = {
              document: plainDocument,
              exhibits: Array.isArray(exhibitsCandidate)
                ? exhibitsCandidate
                : [],
            };

            const validatedFallback = parseSlim(fallback);
            if (validatedFallback) {
              return validatedFallback;
            }
          }

          logger.warn(
            'Argument builder formatting returned unexpected payload shape',
          );
          return null;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            logger.warn(
              'Argument builder formatting timed out after',
              ARGUMENT_BUILDER_FORMATTING_TIMEOUT_MS,
              'ms',
            );
            return null;
          }

          logger.warn('Argument builder formatting threw error:', error);
          return null;
        } finally {
          clearTimeout(timeout);
        }
      };

      if (parsedOutput) {
        type FormattedSection =
          | {
              kind: 'argument';
              key: 'initialArgument' | 'counterArgument' | 'finalArgument';
              title: string;
              value: string;
            }
          | {
              kind: 'validationExplanation';
              validationIndex: number;
              title: string;
              value: string;
            };

        const sections: FormattedSection[] = [];
        if (parsedOutput.initialArgument) {
          sections.push({
            kind: 'argument',
            key: 'initialArgument',
            title: 'Initial Argument',
            value: parsedOutput.initialArgument,
          });
        }
        if (parsedOutput.counterArgument) {
          sections.push({
            kind: 'argument',
            key: 'counterArgument',
            title: 'Counter Argument',
            value: parsedOutput.counterArgument,
          });
        }
        if (parsedOutput.finalArgument) {
          sections.push({
            kind: 'argument',
            key: 'finalArgument',
            title: 'Final Argument',
            value: parsedOutput.finalArgument,
          });
        }
        parsedOutput.validationStatus?.forEach((validation, index) => {
          if (validation.explanation) {
            sections.push({
              kind: 'validationExplanation',
              validationIndex: index,
              title: `Validation Explanation ${index + 1}`,
              value: validation.explanation,
            });
          }
        });

        const sectionSeparator = '<<|ARG_BUILDER_SECTION_BREAK|>>';
        const stripFormattedSectionHeading = (
          content: string,
          title: string,
        ) => {
          const trimmed = content.trimStart();
          const firstLineEnd = trimmed.indexOf('\n');
          const firstLine =
            firstLineEnd === -1 ? trimmed : trimmed.slice(0, firstLineEnd);
          const headingText = firstLine
            .replace(/^#{1,6}\s+/, '')
            .replaceAll('*', '')
            .replace(/:$/, '')
            .trim();

          if (headingText.toLowerCase() !== title.toLowerCase()) {
            return trimmed;
          }

          return firstLineEnd === -1
            ? ''
            : trimmed.slice(firstLineEnd + 1).trimStart();
        };

        if (sections.length > 0) {
          const combinedDocument = sections.map(
            (section) => `## ${section.title}

${section.value}`,
          ).join(`

${sectionSeparator}

`);

          const formattedCombined = await formatCombinedDocument(
            combinedDocument,
            parsedOutput.context,
          );

          if (formattedCombined) {
            if (
              formattedCombined.exhibits &&
              formattedCombined.exhibits.length > 0
            ) {
              parsedOutput.exhibits = formattedCombined.exhibits;
            }
            const escapedSeparator = sectionSeparator.replace(
              /[.*+?^${}()|[\]\\]/g,
              '\\$&',
            );
            const splitRegex = new RegExp(`\\s*${escapedSeparator}\\s*`);
            const formattedSections = formattedCombined.document
              .split(splitRegex)
              .map((segment) => segment.trim());

            if (formattedSections.length === sections.length) {
              sections.forEach((section, index) => {
                const formatted = stripFormattedSectionHeading(
                  formattedSections[index] || section.value,
                  section.title,
                );
                if (section.kind === 'argument') {
                  parsedOutput[section.key] = formatted || section.value;
                  return;
                }

                const validation =
                  parsedOutput.validationStatus?.[section.validationIndex];
                if (validation) {
                  validation.explanation = formatted || section.value;
                }
              });
            } else {
              logger.warn(
                'Argument builder formatting mismatch: section count differs',
              );
            }
          }

          requestItem.output = {
            ...parsedOutput,
            exhibits: parsedOutput.exhibits,
          };
        }
      }
    }
  }

  return NextResponse.json(requestItem, { status: 200 });
}

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<'/api/accounts/cases/[caseId]/requests/[requestId]'>,
) {
  const { caseId, requestId } = await ctx.params;
  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) return unauthorizedResponse();

  let payload: Awaited<ReturnType<typeof validateTokenOrNull>>;
  try {
    payload = await validateTokenOrNull(token, 'DELETE /api/accounts/cases/[caseId]/requests/[requestId]');
  } catch (error) {
    logger.error('Token validation failed during request deletion:', error);
    return internalServerErrorResponse();
  }
  if (!payload?.oid) return unauthorizedResponse('Invalid or missing token');
  const oid = payload.oid as string;

  try {
    await requireUserCaseAccess(oid, caseId, {
      requireIsActive: true,
      allowInactiveGuestAccess: true,
      requiredFeature: 'canGenerateDeclaration',
    });

    const containerName = process.env.COSMOS_SQL_REQUESTS_CONTAINER;
    if (!containerName) {
      logger.error('Missing requests container for request deletion');
      return internalServerErrorResponse();
    }
    const container = getCosmosContainer(containerName);
    const { resources: items } = await container.items.query({
      query: 'SELECT * FROM c WHERE c.accountId = @accountId AND c.id = @requestId AND c.oid = @oid',
      parameters: [
        { name: '@accountId', value: caseId },
        { name: '@requestId', value: requestId },
        { name: '@oid', value: oid },
      ],
    }).fetchAll();

    const item = items[0];
    if (!item || !['argument-builder', 'declaration', 'timeline-builder'].includes(item.type)) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    await container.item(item.id, item.accountId).delete();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof UserAccessError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    logger.error('Error deleting request:', error);
    return internalServerErrorResponse();
  }
}
