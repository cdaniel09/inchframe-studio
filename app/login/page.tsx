import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getChatGPTUser, safeReturn } from '@/app/chatgpt-auth';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { LoginForm } from '@/components/LoginForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Sign in'};

export default async function LoginPage({searchParams}:{searchParams:Promise<{error?:string;returnTo?:string}>}) {
  if (await getChatGPTUser()) redirect('/portal');
  const query = await searchParams;
  const returnTo = safeReturn(query.returnTo);
  return <main><SiteHeader/><section className="auth-page"><div className="shell auth-shell"><div className="auth-copy"><p className="eyebrow"><span>●</span> Private production access</p><h1>Step back into<br/><em>the work.</em></h1><p>Sign in to Inchframe Studio, operated by Unus Mundus LLC, to review versions, leave notes, and approve delivery.</p></div><LoginForm returnTo={returnTo} initialError={query.error==='invalid'}/></div></section><SiteFooter/></main>;
}
