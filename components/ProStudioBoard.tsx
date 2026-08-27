'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProStudioOpportunity } from '@/lib/data';
import { shortDate,titleCase } from '@/lib/format';

export function ProStudioBoard({opportunities}:{opportunities:ProStudioOpportunity[]}){
  const router=useRouter();
  const[busy,setBusy]=useState('');
  const[message,setMessage]=useState('');
  async function save(formElement:HTMLFormElement,projectId:string,action:'submit'|'withdraw'){
    setBusy(projectId);setMessage('');
    const form=new FormData(formElement);
    try{
      const response=await fetch('/api/pro-studio/proposals',{method:'POST',credentials:'include',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({
        projectId,action,amountDollars:Number(form.get('amountDollars')),note:String(form.get('note')||''),
        timelineDays:Number(form.get('timelineDays')),includedRevisions:Number(form.get('includedRevisions'))
      })});
      const result=await response.json() as {message?:string;error?:string};
      if(!response.ok)throw new Error(result.error||'Could not save your proposal.');
      setMessage(result.message||'Proposal saved.');router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:'Could not save your proposal.');}
    finally{setBusy('');}
  }
  if(!opportunities.length)return <div className="empty-state"><span>PRO STUDIO 00</span><h2>No opportunities are open right now.</h2><p>New opportunities appear here after Inchframe reviews a client brief.</p></div>;
  return <div className="project-sections">{opportunities.map(item=><article className="portal-card" key={item.id}>
    <div className="card-heading"><div><span>PRO STUDIO OPPORTUNITY</span><h2>{item.title}</h2></div><b>{titleCase(item.project_type)}</b></div>
    <div className="advanced-summary">
      <div><span>Goal</span><p>{item.brief}</p></div><div><span>Audience</span><p>{item.audience||'Not specified'}</p></div>
      <div><span>Where it runs</span><p>{item.platforms||'Not specified'}</p></div><div><span>Target date</span><p>{shortDate(item.due_date)}</p></div>
      <div><span>Working budget</span><p>{titleCase(item.budget_range)}</p></div><div><span>Closes</span><p>{shortDate(item.marketplace_expires_at)}</p></div>
    </div>
    <form className="admin-review proposal-form" onSubmit={event=>{event.preventDefault();void save(event.currentTarget,item.id,'submit')}}>
      <div><strong>{item.proposal?'Your private proposal':'Send a private proposal'}</strong><p>Your proposal is private. Other partners cannot see your price, your response, or the client’s identity.</p></div>
      <div className="form-grid">
        <label><span>Customer price (USD)</span><input name="amountDollars" type="number" min="1" step="1" required defaultValue={item.proposal?item.proposal.amount_cents/100:''}/></label>
        <label><span>Production days</span><input name="timelineDays" type="number" min="1" max="365" required defaultValue={item.proposal?.timeline_days||14}/></label>
        <label><span>Included revisions</span><input name="includedRevisions" type="number" min="0" max="20" required defaultValue={item.proposal?.included_revisions??2}/></label>
        <label className="wide"><span>Approach and included work</span><textarea name="note" rows={4} maxLength={2000} required defaultValue={item.proposal?.note||''}/></label>
      </div>
      <div className="submit-row"><small>{item.proposal?titleCase(item.proposal.status):'Not submitted'}</small><div>
        {item.proposal?.status==='submitted'&&<button className="button button-outline" disabled={busy===item.id} type="button" onClick={event=>{const form=event.currentTarget.form;if(form)void save(form,item.id,'withdraw')}}>Withdraw</button>}
        <button className="button button-green" disabled={busy===item.id} type="submit">{busy===item.id?'Saving…':item.proposal?'Update proposal':'Submit proposal'}</button>
      </div></div>
    </form>
  </article>)}
  {message&&<p className="control-message" role="status">{message}</p>}</div>;
}
