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
  const accountError=query.error==='sso_config'?'Account sign-in is not configured yet. Use Studio email/password above.':query.error==='sso_cancelled'?'Account sign-in was canceled.':query.error==='suspended'?'Studio access is suspended. Contact Inchframe support.':query.error==='sso'?'Account sign-in expired or could not be completed. Please try again.':'';
  return <main><SiteHeader/><section className="auth-page"><div className="shell auth-shell"><div className="auth-copy"><p className="eyebrow"><span>●</span> Studio client access</p><h1>Return to your<br/><em>production workspace.</em></h1><p>Sign in with your Studio email and password to start an inquiry, review work, approve delivery, or manage an active production.</p></div><div className="auth-stack">
    {localAvailable&&<LoginForm returnTo={returnTo} initialError={query.error==='invalid'} unverified={query.error==='unverified'}/>}
    {accountAvailable&&<div className="auth-card account-auth-card"><span className="card-code">INCHFRAME ACCOUNT</span><h2>Coming from Account?</h2>{accountError&&<p className="form-error" role="alert">{accountError}</p>}<p>Continue with Inchframe Account when you were sent here from Account or need Paid Pro Studio Partner eligibility.</p><a className="button button-outline" href={accountPath}>Continue with Inchframe Account →</a><small>Studio never receives or stores your Account password.</small></div>}
  </div></div></section><SiteFooter/></main>;
}
