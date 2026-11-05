import { NextResponse } from 'next/server';

import { fetchWithTrace } from '@/lib/apiTracing';
import {
  authorizeEvidenceRequest,
  getEvidenceFunctionKeyHeaders,
  getEvidenceSearchUrl,
  handleEvidenceRouteError,
  mapEvidenceServiceStatus,
} from '@/lib/evidenceApi';
import {
  buildAIMIEEvidenceSearchRequest,
  EvidenceExplorerSearchInputSchema,
  EvidenceSearchResponseSchema,
} from '@/lib/evidenceSearch';
import { logger } from '@/lib/logger';

export async function POST(
  request: Request,
  ctx: RouteContext<'/api/accounts/cases/[caseId]/evidence/search'>,
) {
  const { caseId } = await ctx.params;
  if (!caseId) {
    return NextResponse.json({ error: 'Missing caseId parameter' }, { status: 400 });
  }

  try {
    await authorizeEvidenceRequest(
      request,
      caseId,
      'POST /api/accounts/cases/[caseId]/evidence/search',
    );

    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsedInput = EvidenceExplorerSearchInputSchema.safeParse(requestBody);
    if (!parsedInput.success) {
      return NextResponse.json(
        { error: 'Invalid evidence search request' },
        { status: 400 },
      );
    }

    const searchUrl = getEvidenceSearchUrl();
    if (!searchUrl) {
      logger.error('AIMIE evidence search URL is not configured');
      return NextResponse.json(
        { error: 'Evidence search service is not configured' },
        { status: 500 },
      );
    }

    const response = await fetchWithTrace(searchUrl, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...getEvidenceFunctionKeyHeaders(),
      },
      body: JSON.stringify(
        buildAIMIEEvidenceSearchRequest(caseId, parsedInput.data),
      ),
    });

    if (!response.ok) {
      logger.error(
        'AIMIE evidence search failed:',
        response.status,
        response.statusText,
      );
      return NextResponse.json(
        { error: 'Evidence search failed' },
        { status: mapEvidenceServiceStatus(response.status) },
      );
    }

    const payload: unknown = await response.json();
    const parsedResponse = EvidenceSearchResponseSchema.safeParse(payload);
    if (!parsedResponse.success) {
      logger.error('AIMIE evidence search returned an invalid response');
      return NextResponse.json(
        { error: 'Evidence search returned an invalid response' },
        { status: 502 },
      );
    }

    return NextResponse.json({ data: parsedResponse.data });
  } catch (error) {
    return handleEvidenceRouteError(error, 'AIMIE evidence search');
  }
}
