import { NextResponse } from 'next/server';
import { createStudioSession, safeReturn, type ChatGPTUser } from '@/app/chatgpt-auth';
import { findStudioAccount, isStudioAdmin } from '@/lib/data';
import { verifyPassword } from '@/lib/password';

export const runtime = 'nodejs';

function redirectWith(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), 303);
}

export async function POST(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return new Response('Cross-site request rejected.', {status: 403});
  const form = await request.formData();
  const email = String(form.get('email') || '').trim().toLowerCase().slice(0, 254);
  const password = String(form.get('password') || '').slice(0, 512);
  const returnTo = safeReturn(String(form.get('returnTo') || '/portal'));
  let user: ChatGPTUser | null = null;

  if (isStudioAdmin(email)) {
    if (verifyPassword(password, process.env.ADMIN_PASSWORD_HASH)) {
      user = {userId: `admin:${email}`, email, displayName: 'Studio Admin', fullName: 'Studio Admin', role: 'admin'};
    }
  } else {
    const account = await findStudioAccount(email);
    if (account && verifyPassword(password, account.password_hash)) {
      user = {userId: account.id, email: account.email, displayName: account.display_name, fullName: account.display_name, role: 'client'};
    }
  }

  if (!user) return redirectWith(request, `/login?error=invalid&returnTo=${encodeURIComponent(returnTo)}`);
  await createStudioSession(user);
  return redirectWith(request, returnTo);
}
