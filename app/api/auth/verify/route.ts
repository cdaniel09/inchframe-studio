import { NextResponse } from 'next/server';
import { createStudioSession, type ChatGPTUser } from '@/app/chatgpt-auth';
import { verifyStudioAccount } from '@/lib/data';
import { publicUrl } from '@/lib/public-url';
import { hashToken } from '@/lib/tokens';

export const runtime='nodejs';
export async function GET(request:Request) {
  const token=new URL(request.url).searchParams.get('token')?.slice(0,512) || '';
  if(!token) return NextResponse.redirect(publicUrl(request,'/verify-email?error=invalid'),303);
  const account=await verifyStudioAccount(hashToken(token));
  if(!account) return NextResponse.redirect(publicUrl(request,'/verify-email?error=invalid'),303);
  const user:ChatGPTUser={userId:account.id,email:account.email,displayName:account.display_name,fullName:account.display_name,role:'client'};
  await createStudioSession(user);
  return NextResponse.redirect(publicUrl(request,'/start?verified=1'),303);
}
