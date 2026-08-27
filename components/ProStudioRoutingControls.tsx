'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProStudioProposal } from '@/lib/data';

function money(cents:number){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(cents/100);}
export function ProStudioRoutingControls({projectId,status,proposals}:{projectId:string;status:string;proposals:ProStudioProposal[]}){
  const router=useRouter();const[busy,setBusy]=useState('');const[message,setMessage]=useState('');
  async function act(action:'publish'|'close'|'route',proposalId=''){
    setBusy(action+proposalId);setMessage('');
    try{
      const response=await fetch(`/api/projects/${projectId}/marketplace`,{method:'POST',credentials:'include',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({action,proposalId})});
      const result=await response.json() as {message?:string;error?:string};if(!response.ok)throw new Error(result.error||'Could not update Pro Studio routing.');
      setMessage(result.message||'Routing updated.');router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:'Could not update routing.');}
    finally{setBusy('');}
  }
  return <div className="admin-review pro-studio-routing">
    <div><strong>Pro Studio Routing</strong><p>Publish a sanitized brief to verified Studio Partners, review private proposals, then route one. Partners cannot see competitors or client identity.</p></div>
    <div className="submit-row">
      {status!=='published'&&status!=='routed'&&<button className="mini-button approve" disabled={Boolean(busy)} type="button" onClick={()=>act('publish')}>Publish opportunity</button>}
      {status==='published'&&<button className="mini-button" disabled={Boolean(busy)} type="button" onClick={()=>act('close')}>Close opportunity</button>}
      <small>Status: {status}</small>
    </div>
    {proposals.length>0&&<div className="proposal-list">{proposals.map(proposal=><article key={proposal.id}>
      <div><strong>{proposal.partner_name}</strong><span>{money(proposal.amount_cents)} · {proposal.timeline_days} days · {proposal.included_revisions} revisions</span><p>{proposal.note}</p><small>{proposal.status}</small></div>
      {status==='published'&&proposal.status==='submitted'&&<button className="mini-button approve" disabled={Boolean(busy)} type="button" onClick={()=>act('route',proposal.id)}>Route this proposal</button>}
    </article>)}</div>}
    {message&&<p className="control-message" role="status">{message}</p>}
  </div>;
}
