import {
  DELETE as deleteDocument,
  GET as getDocuments,
  PATCH as patchDocument,
  POST as postDocument,
  PUT as putDocument,
} from './[...path]/route';
import { NextRequest } from 'next/server';

type RootContext = RouteContext<'/api/accounts/cases/[caseId]/documents'>;
type DocumentContext =
  RouteContext<'/api/accounts/cases/[caseId]/documents/[...path]'>;

function withRootPath(ctx: RootContext): DocumentContext {
  return {
    params: ctx.params.then(({ caseId }) => ({ caseId, path: [] })),
  };
}

export function GET(request: NextRequest, ctx: RootContext) {
  return getDocuments(request, withRootPath(ctx));
}

export function POST(request: NextRequest, ctx: RootContext) {
  return postDocument(request, withRootPath(ctx));
}

export function PUT(request: NextRequest, ctx: RootContext) {
  return putDocument(request, withRootPath(ctx));
}

export function PATCH(request: NextRequest, ctx: RootContext) {
  return patchDocument(request, withRootPath(ctx));
}

export function DELETE(request: NextRequest, ctx: RootContext) {
  return deleteDocument(request, withRootPath(ctx));
}
