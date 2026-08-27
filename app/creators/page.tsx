import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { listPublicCreators } from '@/lib/data';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Studio Partner Directory',description:'Meet vetted Studio Partners available for Inchframe-led productions.'};
export default async function CreatorsDirectoryPage(){
  const creators=await listPublicCreators();
  return <main><SiteHeader/>
    <section className="page-hero creator-directory-hero"><div className="shell"><p className="eyebrow"><span>●</span> Inchframe Pro Studio</p><h1>Studio Partners.<br/><em>One production desk.</em></h1><p className="hero-lede">Choose a production fit or ask Inchframe to route one. Studio Partners quote privately; Inchframe handles payment, communication, and delivery.</p><div className="hero-actions"><Link className="button button-green" href="/start">Request a private match →</Link><Link className="button button-outline" href="/creators/apply">Become a Studio Partner</Link></div></div></section>
    <section className="portal-content"><div className="shell">{creators.length===0?<div className="empty-state"><span>NETWORK 00</span><h2>Studio Partner reviews are underway.</h2><p>The first vetted Studio Partners will appear here after Studio approval.</p></div>:<div className="creator-grid">{creators.map(creator=><Link className="creator-card" href={`/creators/${creator.slug}`} key={creator.id}><img src={`/api/creator-icons/${creator.id}`} alt=""/><div><span className="card-code">INCHFRAME STUDIO PARTNER</span><h2>{creator.display_name}</h2><strong>{creator.headline}</strong><p>{creator.location} · {creator.availability}</p><small>{creator.specialties}</small></div><b aria-hidden="true">→</b></Link>)}</div>}</div></section>
    <SiteFooter/>
  </main>;
}
