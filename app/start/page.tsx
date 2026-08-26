import type { Metadata } from 'next';
import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { PortalHeader } from '@/components/PortalHeader';
import { IntakeForm } from '@/components/IntakeForm';
import { SiteFooter } from '@/components/SiteFooter';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Start a project',description:'Submit a short Inchframe Studio project inquiry.'};
export default async function StartPage(){const user=await requireChatGPTUser('/start');return <main><PortalHeader user={user}/><section className="page-hero"><div className="shell narrow"><p className="eyebrow"><span>●</span> Short project inquiry</p><h1>Start with the<br/><em>essential brief.</em></h1><p className="hero-lede">Give us enough to judge fit, timing, and budget. No images or audio yet. Accepted projects receive a private code for the advanced workspace.</p></div></section><section className="form-shell"><div className="shell narrow"><IntakeForm/></div></section><SiteFooter/></main>}
