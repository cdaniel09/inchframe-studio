import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getChatGPTUser, safeReturn } from '@/app/chatgpt-auth';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Sign in'};

export default async function LoginPage({searchParams}:{searchParams:Promise<{error?:string;returnTo?:string}>}) {
  if (await getChatGPTUser()) redirect('/portal');
  const query = await searchParams;
  const returnTo = safeReturn(query.returnTo);
  return <main><SiteHeader/><section className="auth-page"><div className="shell auth-shell"><div className="auth-copy"><p className="eyebrow"><span>●</span> Private production access</p><h1>Step back into<br/><em>the work.</em></h1><p>Clients can review versions, leave exact notes, and approve delivery. Studio admin can manage every active production.</p></div><form className="auth-card" method="post" action="/api/auth/login"><span className="card-code">SECURE SIGN IN</span><h2>Welcome back.</h2>{query.error&&<p className="form-error" role="alert">That email or password was not recognized.</p>}<input type="hidden" name="returnTo" value={returnTo}/><label><span>Email</span><input name="email" type="email" autoComplete="email" required/></label><label><span>Password</span><input name="password" type="password" autoComplete="current-password" required/></label><button className="button button-green" type="submit">Sign in →</button><p>New client? <Link href="/register">Create access with your Studio code.</Link></p></form></div></section><SiteFooter/></main>;
}
