import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getChatGPTUser,safeReturn } from '@/app/chatgpt-auth';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { LoginForm } from '@/components/LoginForm';
import {studioAuthMode,studioSsoConfigured} from '@/lib/account-sso';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Sign in'};
export default async function LoginPage({searchParams}:{searchParams:Promise<{error?:string;returnTo?:string}>}){
  if(await getChatGPTUser())redirect('/portal');
  const query=await searchParams,returnTo=safeReturn(query.returnTo);
  const mode=studioAuthMode(),accountAvailable=studioSsoConfigured()&&mode!=='local',localAvailable=mode!=='account';
  const intent=returnTo.startsWith('/studio-partners/apply')?'studio_partner':'customer';
  const accountPath=`/api/auth/account/start?returnTo=${encodeURIComponent(returnTo)}&intent=${intent}`;
  const accountError=query.error==='sso_config'?'Account sign-in is not configured yet. Use the temporary Studio sign-in below.':query.error==='sso_cancelled'?'Account sign-in was canceled.':query.error==='suspended'?'Studio access is suspended. Contact Inchframe support.':query.error==='sso'?'Account sign-in expired or could not be completed. Please try again.':'';
  return <main><SiteHeader/><section className="auth-page"><div className="shell auth-shell"><div className="auth-copy"><p className="eyebrow"><span>●</span> One Inchframe account</p><h1>One login.<br/><em>Every workspace.</em></h1><p>Use the same Inchframe Account for project inquiries, Studio Partner applications, private production work, reviews, and delivery.</p></div><div className="auth-stack">
    {accountAvailable&&<div className="auth-card account-auth-card"><span className="card-code">INCHFRAME ACCOUNT</span><h2>Continue securely.</h2>{accountError&&<p className="form-error" role="alert">{accountError}</p>}<p>Sign in or create your Account, then return directly to the page you requested.</p><a className="button button-green" href={accountPath}>Continue with Inchframe Account →</a><small>Studio never receives or stores your Account password.</small></div>}
    {localAvailable&&<details className="local-auth-fallback" open={!accountAvailable||Boolean(query.error&&['invalid','unverified','session','sso_config'].includes(query.error))}><summary>Temporary Studio sign-in</summary><LoginForm returnTo={returnTo} initialError={query.error==='invalid'} unverified={query.error==='unverified'} sessionExpired={query.error==='session'}/></details>}
  </div></div></section><SiteFooter/></main>;
}
