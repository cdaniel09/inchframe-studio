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
      <p className="hero-lede">Choose a certified creator or ask Inchframe to match the project. The creator sets the quote; you can accept or make a structured counteroffer before paying.</p>
    </div></section>
    <section className="form-shell"><div className="shell narrow">
      {creator?<div className="creator-policy selected-creator">
        <img src={`/api/creator-icons/${creator.id}`} alt=""/>
        <div><span className="card-code">REQUESTING THROUGH INCHFRAME</span><strong>{creator.display_name}</strong><p>The creator will review this brief and quote inside Studio. Contact and production stay inside Inchframe.</p><Link href={`/creators/${creator.slug}`}>Review creator profile ↗</Link></div>
      </div>:<div className="creator-policy selected-creator match-request">
        <div><span className="card-code">MATCH ME</span><strong>Let Inchframe choose the production fit.</strong><p>The Studio routes the brief to one certified creator—never an open bidding pool.</p><Link href="/creators">Or choose from the creator directory →</Link></div>
      </div>}
      <IntakeForm creatorSlug={creator?.slug}/>
    </div></section>
    <SiteFooter/>
  </main>;
}
