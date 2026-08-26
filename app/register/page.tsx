import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { RegisterForm } from '@/components/RegisterForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Create client access'};

export default async function RegisterPage({searchParams}:{searchParams:Promise<{error?:string}>}) {
  if (await getChatGPTUser()) redirect('/portal');
  const query = await searchParams;
  return <main><SiteHeader/><section className="auth-page"><div className="shell auth-shell"><div className="auth-copy"><p className="eyebrow"><span>●</span> Client access</p><h1>Your project.<br/><em>One clear home.</em></h1><p>Create a private Inchframe Studio account using the access code supplied by Unus Mundus LLC. Your briefs, seeds, reviews, and approvals stay together.</p></div><RegisterForm initialError={query.error}/></div></section><SiteFooter/></main>;
}
