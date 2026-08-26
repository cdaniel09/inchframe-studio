import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { listPublicCreators } from '@/lib/data';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Certified creators',description:'Meet certified Inchframe creators available for Inchframe-led productions.'};
export default async function CreatorsDirectoryPage(){
  const creators=await listPublicCreators();
  return <main><SiteHeader/>
    <section className="page-hero creator-directory-hero"><div className="shell"><p className="eyebrow"><span>●</span> Inchframe production network</p><h1>Certified creators.<br/><em>One production desk.</em></h1><p className="hero-lede">Choose a creative fit or ask Inchframe to route one. Creators quote privately; Inchframe handles payment, production communication, and delivery.</p><div className="hero-actions"><Link className="button button-green" href="/start">Match me with a creator →</Link><Link className="button button-outline" href="/creators/apply">Apply as a Paid Pro creator</Link></div></div></section>
    <section className="portal-content"><div className="shell">{creators.length===0?<div className="empty-state"><span>NETWORK 00</span><h2>Creator reviews are underway.</h2><p>The first certified production members will appear here after Studio approval.</p></div>:<div className="creator-grid">{creators.map(creator=><Link className="creator-card" href={`/creators/${creator.slug}`} key={creator.id}><img src={`/api/creator-icons/${creator.id}`} alt=""/><div><span className="card-code">CERTIFIED INCHFRAME CREATOR</span><h2>{creator.display_name}</h2><strong>{creator.headline}</strong><p>{creator.location} · {creator.availability}</p><small>{creator.specialties}</small></div><b aria-hidden="true">→</b></Link>)}</div>}</div></section>
    <SiteFooter/>
  </main>;
}
