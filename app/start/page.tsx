import Link from 'next/link';
import type { Metadata } from 'next';
import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { PortalHeader } from '@/components/PortalHeader';
import { IntakeForm } from '@/components/IntakeForm';
import { SiteFooter } from '@/components/SiteFooter';
import { getPublicCreatorBySlug } from '@/lib/data';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Start a project',description:'Submit a short Inchframe Studio project inquiry.'};

export default async function StartPage({searchParams}:{searchParams:Promise<{creator?:string}>}){
  const query=await searchParams;
  const creatorSlug=String(query.creator||'').slice(0,100);
  const returnTo=creatorSlug?`/start?creator=${encodeURIComponent(creatorSlug)}`:'/start';
  const user=await requireChatGPTUser(returnTo);
  const creator=creatorSlug?await getPublicCreatorBySlug(creatorSlug):null;

  return <main>
    <PortalHeader user={user}/>
    <section className="page-hero"><div className="shell narrow">
      <p className="eyebrow"><span>●</span> Short project inquiry</p>
      <h1>Start with the<br/><em>essential brief.</em></h1>
      <p className="hero-lede">Choose a Studio Partner, let Inchframe match your project, or request Pro Studio. Every proposal and project conversation stays private.</p>
    </div></section>
    <section className="form-shell"><div className="shell narrow">
      {creator?<div className="creator-policy selected-creator">
        <img src={`/api/creator-icons/${creator.id}`} alt=""/>
        <div><span className="card-code">REQUESTING THROUGH INCHFRAME</span><strong>{creator.display_name}</strong><p>The Studio Partner will review this brief and quote inside Studio. Contact and production stay inside Inchframe.</p><Link href={`/creators/${creator.slug}`}>Review Studio Partner profile ↗</Link></div>
      </div>:<div className="creator-policy selected-creator match-request">
        <div><span className="card-code">YOUR PRODUCTION PATH</span><strong>Choose how you want to begin.</strong><p>Request a private match or invite Studio Partners through Pro Studio. Inchframe reviews the brief before anyone else sees it.</p><Link href="/creators">Or choose from the Studio Partner Directory →</Link></div>
      </div>}
      <IntakeForm creatorSlug={creator?.slug}/>
    </div></section>
    <SiteFooter/>
  </main>;
}
