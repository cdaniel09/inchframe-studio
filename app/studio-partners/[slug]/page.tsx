import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { getPublicCreatorBySlug,studioMinimumCents } from '@/lib/data';

function money(value:number){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const{slug}=await params;const creator=await getPublicCreatorBySlug(slug);return creator?{title:creator.display_name,description:creator.headline}:{title:'Studio Partner not found'};}

export default async function CreatorProfilePage({params}:{params:Promise<{slug:string}>}){
  const{slug}=await params;const creator=await getPublicCreatorBySlug(slug);if(!creator)notFound();
  const projectMinimum=Math.max(studioMinimumCents()/100,creator.rate_min);
  return <main><SiteHeader/>
    <section className="creator-profile-hero"><div className="shell creator-profile-grid"><img className="creator-icon" src={`/api/creator-icons/${creator.id}`} alt={`${creator.display_name} profile icon`}/><div><p className="eyebrow"><span>●</span> Inchframe Studio Partner</p><h1>{creator.display_name}</h1><p className="creator-headline">{creator.headline}</p><div className="creator-tags">{creator.specialties.split(',').map(item=><span key={item}>{item.trim()}</span>)}</div></div></div></section>
    <section className="section creator-profile-body"><div className="shell creator-detail-grid"><div><h2>Production profile</h2><p className="preserve-lines">{creator.bio}</p>{creator.samples.length>0&&<div className="sample-list"><h2>Selected work</h2>{creator.samples.map((sample,index)=><a href={sample.url} target="_blank" rel="noreferrer nofollow" key={sample.id}><span>{String(index+1).padStart(2,'0')}</span><strong>{sample.title}</strong><b>View example ↗</b></a>)}</div>}</div>
      <aside className="creator-booking"><span className="card-code">PRIVATE INCHFRAME QUOTING</span><div><small>Projects from</small><strong>{money(projectMinimum)}</strong><p>Studio Partner sets the final customer-facing quote</p></div><div><small>Location</small><strong>{creator.location}</strong></div><div><small>Availability</small><strong>{creator.availability}</strong></div><p>Send a short brief. The Studio Partner can quote or decline privately; you can accept or make up to two counteroffers. Direct contact details are never published.</p><Link className="button button-green" href={`/start?creator=${encodeURIComponent(creator.slug)}`}>Request this Studio Partner →</Link><Link className="button button-outline" href="/start">Request a private match</Link></aside>
    </div></section><SiteFooter/>
  </main>;
}
