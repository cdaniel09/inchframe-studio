import type {Metadata} from 'next';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {getChatGPTUser,requireChatGPTUser,type ChatGPTUser} from '@/app/chatgpt-auth';
import {CreatorApplicationForm} from '@/components/CreatorApplicationForm';
import {PortalHeader} from '@/components/PortalHeader';
import {SiteHeader} from '@/components/SiteHeader';
import {SiteFooter} from '@/components/SiteFooter';
import {getAccountSsoEligibility,getCreatorApplicationForUser} from '@/lib/data';
import {studioPartnerApplicationsOpen} from '@/lib/studio-launch';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Become a Studio Partner'};

function ApplicationsPaused({user}:{user:ChatGPTUser|null}){return <main>{user?<PortalHeader user={user}/>:<SiteHeader/>}
  <section className="page-hero"><div className="shell narrow"><p className="eyebrow"><span>●</span> Studio pre-launch</p><h1>Partner applications<br/><em>are opening later.</em></h1><p className="hero-lede">Inchframe is completing customer payments, Partner payouts, verification, and production operations before adding external Studio Partners. No new applications are being accepted right now.</p><div className="hero-actions"><Link className="button button-green" href="/studio-partners#directory">View the current Studio network →</Link><Link className="button button-outline" href="/register">Start a client inquiry</Link></div></div></section><SiteFooter/>
</main>}

export default async function CreatorApplyPage({searchParams}:{searchParams:Promise<{intent?:string}>}){
  const query=await searchParams;
  const applicationsOpen=studioPartnerApplicationsOpen(),initialUser=await getChatGPTUser();
  if(!applicationsOpen&&!initialUser)return <ApplicationsPaused user={null}/>;
  if(applicationsOpen&&query.intent==='studio_partner')
    redirect('/api/auth/account/start?returnTo=%2Fstudio-partners%2Fapply&intent=studio_partner');
  const user=initialUser||await requireChatGPTUser('/studio-partners/apply');
  const profile=await getCreatorApplicationForUser(user),account=await getAccountSsoEligibility(user);
  if(!applicationsOpen&&!profile)return <ApplicationsPaused user={user}/>;
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
        <p>Your Account login is working, but Studio has not received current paid Pro Partner eligibility. Activate paid Pro, then refresh your Account connection here.</p>
        <div className="hero-actions"><a className="button button-green" href="/api/auth/account/start?returnTo=%2Fstudio-partners%2Fapply&intent=studio_partner">Refresh from Inchframe Account →</a><a className="button button-outline" href="https://account.inchframe.com/account">Open Account</a></div>
      </div>:<CreatorApplicationForm profile={profile} accountEmail={linked?user.email:null} internalPartner={profile?.internal_partner===1}/>}
    </div></section>
    <SiteFooter/>
  </main>;
}
