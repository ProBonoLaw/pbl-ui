import { NextResponse } from 'next/server';

export function unauthorizedResponse(error = 'Unauthorized') {
  return NextResponse.json({ error }, { status: 401 });
}

export function internalServerErrorResponse(error = 'Internal Server Error') {
  return NextResponse.json({ error }, { status: 500 });
}
