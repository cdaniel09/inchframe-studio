import type { Metadata } from 'next';
import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { PortalHeader } from '@/components/PortalHeader';
import { IntakeForm } from '@/components/IntakeForm';
import { SiteFooter } from '@/components/SiteFooter';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Start a project',description:'Submit a private Inchframe Studio production brief and visual seed images.'};
export default async function StartPage(){const user=await requireChatGPTUser('/start');return <main><PortalHeader user={user}/><section className="page-hero"><div className="shell narrow"><p className="eyebrow"><span>●</span> Private project intake</p><h1>Start with the<br/><em>right brief.</em></h1><p className="hero-lede">Your answers give the Studio enough context to shape the concept, production scope, schedule, and quote.</p></div></section><section className="form-shell"><div className="shell narrow"><IntakeForm/></div></section><SiteFooter/></main>}
