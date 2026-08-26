import { NextResponse } from 'next/server';
import { clearStudioSession, safeReturn } from '@/app/chatgpt-auth';
import { publicUrl } from '@/lib/public-url';

export async function GET(request: Request) {
  const returnTo = safeReturn(new URL(request.url).searchParams.get('returnTo'));
  await clearStudioSession();
  return NextResponse.redirect(publicUrl(request, returnTo), 303);
}

export async function POST(request: Request) {
  return GET(request);
}
