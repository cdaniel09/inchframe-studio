import Link from 'next/link';
import type { Metadata } from 'next';
import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { PortalHeader } from '@/components/PortalHeader';
import { IntakeForm } from '@/components/IntakeForm';
import { SiteFooter } from '@/components/SiteFooter';
import { getPublicCreatorBySlug } from '@/lib/data';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Start a project',description:'Submit a short Inchframe Studio project inquiry.'};
export default async function StartPage({searchParams}:{searchParams:Promise<{creator?:string}>}){const query=await searchParams,creatorSlug=String(query.creator||'').slice(0,100);const returnTo=creatorSlug?`/start?creator=${encodeURIComponent(creatorSlug)}`:'/start';const user=await requireChatGPTUser(returnTo);const creator=creatorSlug?await getPublicCreatorBySlug(creatorSlug):null;return <main><PortalHeader user={user}/><section className="page-hero"><div className="shell narrow"><p className="eyebrow"><span>●</span> Short project inquiry</p><h1>Start with the<br/><em>essential brief.</em></h1><p className="hero-lede">Give us enough to judge fit, timing, and budget. No images or audio yet. Accepted projects receive a private code for the advanced workspace.</p></div></section><section className="form-shell"><div className="shell narrow">{creator&&<div className="creator-policy selected-creator"><img src={`/api/creator-icons/${creator.id}`} alt=""/><div><span className="card-code">REQUESTING THROUGH INCHFRAME</span><strong>{creator.display_name}</strong><p>Inchframe will confirm fit, scope, availability, and rates before making the production connection.</p><Link href={`/creators/${creator.slug}`}>Review creator profile ↗</Link></div></div>}<IntakeForm/></div></section><SiteFooter/></main>}
