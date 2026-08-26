import { NextResponse } from 'next/server';
import { createStudioSession, type ChatGPTUser } from '@/app/chatgpt-auth';
import { createStudioAccount, findStudioAccount, isStudioAdmin } from '@/lib/data';
import { hashPassword, secretsEqual } from '@/lib/password';
import { publicUrl } from '@/lib/public-url';

export const runtime = 'nodejs';

function redirectWith(request: Request, path: string) {
  return NextResponse.redirect(publicUrl(request, path), 303);
}

export async function POST(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return new Response('Cross-site request rejected.', {status: 403});
  const form = await request.formData();
  const displayName = String(form.get('displayName') || '').trim().slice(0, 100);
  const email = String(form.get('email') || '').trim().toLowerCase().slice(0, 254);
  const password = String(form.get('password') || '').slice(0, 512);
  const accessCode = String(form.get('accessCode') || '').slice(0, 512);

  if (!secretsEqual(accessCode, process.env.CLIENT_SIGNUP_CODE)) return redirectWith(request, '/register?error=access');
  if (!displayName || !email.includes('@') || password.length < 10) return redirectWith(request, '/register?error=fields');
  if (isStudioAdmin(email) || await findStudioAccount(email)) return redirectWith(request, '/register?error=exists');

  try {
    const id = await createStudioAccount({email, displayName, passwordHash: hashPassword(password)});
    const user: ChatGPTUser = {userId: id, email, displayName, fullName: displayName, role: 'client'};
    await createStudioSession(user);
    return redirectWith(request, '/start');
  } catch {
    return redirectWith(request, '/register?error=exists');
  }
}
