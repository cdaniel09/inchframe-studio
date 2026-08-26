import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { RegisterForm } from '@/components/RegisterForm';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Create client access'};
export default async function RegisterPage({searchParams}:{searchParams:Promise<{error?:string}>}) {
  if(await getChatGPTUser()) redirect('/portal');
  const query=await searchParams;
  return <main><SiteHeader/><section className="auth-page"><div className="shell auth-shell"><div className="auth-copy"><p className="eyebrow"><span>●</span> Open project inquiries</p><h1>Start simple.<br/><em>Build if it fits.</em></h1><p>Create an account with your name, email, and password. After email verification, send a short inquiry—no invitation code and no large uploads. If the Studio accepts the project, we’ll email a one-time code that unlocks the full media workspace.</p></div><RegisterForm initialError={query.error}/></div></section><SiteFooter/></main>;
}
