import { NextResponse } from 'next/server';
import { clearStudioSession, safeReturn } from '@/app/chatgpt-auth';

export async function GET(request: Request) {
  const returnTo = safeReturn(new URL(request.url).searchParams.get('returnTo'));
  await clearStudioSession();
  return NextResponse.redirect(new URL(returnTo, request.url), 303);
}

export async function POST(request: Request) {
  return GET(request);
}
