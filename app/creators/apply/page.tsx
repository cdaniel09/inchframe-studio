import type { Metadata } from 'next';
import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { PortalHeader } from '@/components/PortalHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { CreatorApplicationForm } from '@/components/CreatorApplicationForm';
import { getCreatorApplicationForUser } from '@/lib/data';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Become a certified creator'};
export default async function CreatorApplyPage(){const user=await requireChatGPTUser('/creators/apply');const profile=await getCreatorApplicationForUser(user);return <main><PortalHeader user={user}/><section className="page-hero"><div className="shell narrow"><p className="eyebrow"><span>●</span> Inchframe production network</p><h1>Become a certified<br/><em>Inchframe creator.</em></h1><p className="hero-lede">Paid Pro members can apply to join Inchframe-led productions as independent creative subcontractors. Inchframe qualifies the brief, handles the client relationship, and brings the right creators into the work.</p></div></section><section className="form-shell"><div className="shell narrow"><div className="creator-policy"><strong>Paid Pro only.</strong><p>Certification is reviewed—not automatic. Your public page shows your icon, production strengths, work rates, and up to five external sample links. Personal contact details stay private.</p></div><CreatorApplicationForm profile={profile}/></div></section><SiteFooter/></main>}
