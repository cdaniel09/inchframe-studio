import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {requireChatGPTUser} from '@/app/chatgpt-auth';
import {CreatorApplicationForm} from '@/components/CreatorApplicationForm';
import {PortalHeader} from '@/components/PortalHeader';
import {SiteFooter} from '@/components/SiteFooter';
import {getAccountSsoEligibility,getCreatorApplicationForUser} from '@/lib/data';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Become a Studio Partner'};

export default async function CreatorApplyPage({searchParams}:{searchParams:Promise<{intent?:string}>}){
  const query=await searchParams;
  if(query.intent==='studio_partner')
    redirect('/api/auth/account/start?returnTo=%2Fstudio-partners%2Fapply&intent=studio_partner');
  const user=await requireChatGPTUser('/studio-partners/apply');
  const profile=await getCreatorApplicationForUser(user),account=await getAccountSsoEligibility(user);
  const linked=account?.auth_source==='account',eligible=account?.studio_partner_eligible===1;
  return <main><PortalHeader user={user}/>
    <section className="page-hero"><div className="shell narrow">
      <p className="eyebrow"><span>●</span> Inchframe Pro Studio</p>
      <h1>Become an Inchframe<br/><em>Studio Partner.</em></h1>
      <p className="hero-lede">Eligible paid Inchframe members can apply to join Inchframe-led productions as independent Studio Partners. Inchframe qualifies the brief, handles the client relationship, and brings the right Studio Partners into the work.</p>
    </div></section>
    <section className="form-shell"><div className="shell narrow">
      <div className="creator-policy"><strong>Eligible paid membership required.</strong><p>Studio Partner approval is reviewed—not automatic. Your public page shows your icon, production strengths, work rates, and up to five external sample links. Personal contact details stay private.</p></div>
      {linked&&!eligible&&!profile?<div className="empty-state">
        <span>PAID PRO REQUIRED</span><h2>Refresh your Studio Partner eligibility.</h2>
        <p>Your Account login is working, but Studio has not received current paid Pro Partner eligibility. Activate paid Pro or generate the Partner invitation in Account, then refresh here.</p>
        <div className="hero-actions"><a className="button button-green" href="/api/auth/account/start?returnTo=%2Fstudio-partners%2Fapply&intent=studio_partner">Refresh from Inchframe Account →</a><a className="button button-outline" href="https://account.inchframe.com/account">Open Account</a></div>
      </div>:<CreatorApplicationForm profile={profile} accountEmail={linked?user.email:null} ssoEligible={eligible}/>}
    </div></section>
    <SiteFooter/>
  </main>;
}
