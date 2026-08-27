import type { Metadata } from 'next';
import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { PortalHeader } from '@/components/PortalHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { CreatorApplicationForm } from '@/components/CreatorApplicationForm';
import { getCreatorApplicationForUser } from '@/lib/data';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Become a Studio Partner'};
export default async function CreatorApplyPage(){const user=await requireChatGPTUser('/creators/apply');const profile=await getCreatorApplicationForUser(user);return <main><PortalHeader user={user}/><section className="page-hero"><div className="shell narrow"><p className="eyebrow"><span>●</span> Inchframe Pro Studio</p><h1>Become an Inchframe<br/><em>Studio Partner.</em></h1><p className="hero-lede">Eligible paid Inchframe members can apply to join Inchframe-led productions as independent Studio Partners. Inchframe qualifies the brief, handles the client relationship, and brings the right creators into the work.</p></div></section><section className="form-shell"><div className="shell narrow"><div className="creator-policy"><strong>Eligible paid membership required.</strong><p>Studio Partner approval is reviewed—not automatic. Your public page shows your icon, production strengths, work rates, and up to five external sample links. Personal contact details stay private.</p></div><CreatorApplicationForm profile={profile}/></div></section><SiteFooter/></main>}
