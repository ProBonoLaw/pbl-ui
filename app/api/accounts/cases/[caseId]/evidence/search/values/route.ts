import { NextResponse } from 'next/server';

import { fetchWithTrace } from '@/lib/apiTracing';
import {
  authorizeEvidenceRequest,
  getEvidenceFunctionKeyHeaders,
  getEvidenceSearchUrl,
  handleEvidenceRouteError,
  mapEvidenceServiceStatus,
} from '@/lib/evidenceApi';
import { EvidenceValuesSchema } from '@/lib/evidenceSearch';
import { logger } from '@/lib/logger';

export async function GET(
  request: Request,
  ctx: RouteContext<'/api/accounts/cases/[caseId]/evidence/search/values'>,
) {
  const { caseId } = await ctx.params;
  if (!caseId) {
    return NextResponse.json({ error: 'Missing caseId parameter' }, { status: 400 });
  }

  try {
    await authorizeEvidenceRequest(
      request,
      caseId,
      'GET /api/accounts/cases/[caseId]/evidence/search/values',
    );

    const searchUrl = getEvidenceSearchUrl();
    if (!searchUrl) {
      logger.error('AIMIE evidence search URL is not configured');
      return NextResponse.json(
        { error: 'Evidence search service is not configured' },
        { status: 500 },
      );
    }

    const valuesUrl = new URL(`${searchUrl.replace(/\/+$/, '')}/values`);
    valuesUrl.searchParams.set('accountId', caseId);
    const response = await fetchWithTrace(valuesUrl.toString(), {
      method: 'GET',
      cache: 'no-store',
      headers: getEvidenceFunctionKeyHeaders(),
    });

    if (!response.ok) {
      logger.error(
        'AIMIE evidence values request failed:',
        response.status,
        response.statusText,
      );
      return NextResponse.json(
        { error: 'Evidence filters could not be loaded' },
        { status: mapEvidenceServiceStatus(response.status) },
      );
    }

    const payload: unknown = await response.json();
    const parsedResponse = EvidenceValuesSchema.safeParse(payload);
    if (!parsedResponse.success) {
      logger.error('AIMIE evidence values returned an invalid response');
      return NextResponse.json(
        { error: 'Evidence filters returned an invalid response' },
        { status: 502 },
      );
    }

    return NextResponse.json({ data: parsedResponse.data });
  } catch (error) {
    return handleEvidenceRouteError(error, 'AIMIE evidence values');
  }
}
