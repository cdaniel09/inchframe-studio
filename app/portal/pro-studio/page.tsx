import Link from 'next/link';
import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { PortalHeader } from '@/components/PortalHeader';
import { ProStudioBoard } from '@/components/ProStudioBoard';
import { getStudioPartnerEligibility,listProStudioOpportunities } from '@/lib/data';
export const dynamic='force-dynamic';
export const metadata={title:'Pro Studio Opportunities'};
export default async function ProStudioPage(){
  const user=await requireChatGPTUser('/portal/pro-studio');
  const eligibility=await getStudioPartnerEligibility(user);
  const opportunities=eligibility.eligible?await listProStudioOpportunities(user):[];
  return <main className="portal-page"><PortalHeader user={user}/>
    <section className="project-banner"><div className="shell"><p className="eyebrow"><span>●</span> Studio Partner workspace</p><div className="project-title-grid"><div><h1>Pro Studio<br/>Opportunities.</h1><p>Review production opportunities, send private proposals, and manage accepted work through Inchframe.</p></div><div className="project-facts"><div><span>Access</span><strong>{eligibility.eligible?'Studio Partner':'Complete partner approval'}</strong></div><div><span>Privacy</span><strong>Private proposals</strong></div></div></div></div></section>
    <section className="portal-content"><div className="shell">
      {!eligibility.eligible?<div className="empty-state"><span>PARTNER ACCESS</span><h2>Complete your Studio Partner approval.</h2><p>Access opens after Inchframe confirms your paid membership, Studio Partner profile, identity, tax details, and payout readiness.</p><Link className="button button-green" href="/creators/apply">Become a Studio Partner →</Link></div>:<ProStudioBoard opportunities={opportunities}/>}
    </div></section>
  </main>;
}
