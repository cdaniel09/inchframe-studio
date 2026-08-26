import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { ResendVerificationForm } from '@/components/ResendVerificationForm';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Verify your email'};
export default async function VerifyEmailPage({searchParams}:{searchParams:Promise<{email?:string;error?:string}>}) {
  const query=await searchParams;
  return <main><SiteHeader/><section className="auth-page"><div className="shell auth-shell"><div className="auth-copy"><p className="eyebrow"><span>●</span> One quick check</p><h1>Verify, then<br/><em>send the idea.</em></h1><p>Email verification keeps automated junk out without putting an invitation wall in front of real customers.</p>{query.error==='invalid'&&<p className="form-error">That verification link is invalid or expired. Request a fresh one.</p>}</div><ResendVerificationForm initialEmail={query.email||''}/></div></section><SiteFooter/></main>;
}
