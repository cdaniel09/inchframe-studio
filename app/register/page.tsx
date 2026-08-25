import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Create client access'};

const errors: Record<string,string> = {
  access: 'That client access code is not valid.',
  fields: 'Enter your name, a valid email, and a password of at least 10 characters.',
  exists: 'An account with that email already exists. Try signing in instead.',
};

export default async function RegisterPage({searchParams}:{searchParams:Promise<{error?:string}>}) {
  if (await getChatGPTUser()) redirect('/portal');
  const query = await searchParams;
  return <main><SiteHeader/><section className="auth-page"><div className="shell auth-shell"><div className="auth-copy"><p className="eyebrow"><span>●</span> Client access</p><h1>Your project.<br/><em>One clear home.</em></h1><p>Create a private account using the access code supplied by Inchframe Studio. Your briefs, seeds, reviews, and approvals stay together.</p></div><form className="auth-card" method="post" action="/api/auth/register"><span className="card-code">CREATE CLIENT ACCESS</span><h2>Open your workspace.</h2>{query.error&&<p className="form-error" role="alert">{errors[query.error]||'Could not create your account.'}</p>}<label><span>Your name</span><input name="displayName" autoComplete="name" required maxLength={100}/></label><label><span>Email</span><input name="email" type="email" autoComplete="email" required/></label><label><span>Password</span><input name="password" type="password" autoComplete="new-password" minLength={10} required/></label><label><span>Studio access code</span><input name="accessCode" type="password" autoComplete="off" required/></label><button className="button button-green" type="submit">Create client area →</button><p>Already registered? <Link href="/login">Sign in.</Link></p></form></div></section><SiteFooter/></main>;
}
