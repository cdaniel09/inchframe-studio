'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProjectActivity } from '@/lib/data';

type Viewer='client'|'creator'|'admin';
export function ProjectActivityLog({projectId,items,viewer}:{projectId:string;items:ProjectActivity[];viewer:Viewer}){
  const router=useRouter(),[busy,setBusy]=useState(''),[message,setMessage]=useState('');
  async function send(payload:Record<string,unknown>){setBusy(String(payload.activityId||'post'));setMessage('');try{const response=await fetch(`/api/projects/${projectId}/activity`,{method:'POST',credentials:'include',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const result=await response.json() as {message?:string;error?:string};if(!response.ok)throw new Error(result.error||'Could not update the project log.');setMessage(result.message||'Project log updated.');router.refresh();return true;}catch(reason){setMessage(reason instanceof Error?reason.message:'Could not update the project log.');return false;}finally{setBusy('');}}
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);if(await send({kind:form.get('kind'),title:form.get('title'),body:form.get('body'),nextStep:form.get('nextStep'),needsResponseFrom:form.get('needsResponseFrom'),targetDate:form.get('targetDate')}))event.currentTarget.reset();}
  const kinds=viewer==='client'?[['message','Message'],['decision','Decision / answer'],['blocker','Concern / blocker']]:[['progress','Progress update'],['milestone','Milestone'],['message','Message'],['decision','Decision needed'],['blocker','Blocker / risk'],['delivery','Delivery notice']];
  return <div className="activity-workspace">
    <div className="communication-rule"><strong>Studio is the project communication record.</strong><p>Keep feedback, scope decisions, schedule changes, approvals, and delivery notices here. If something is discussed elsewhere, summarize it in this log.</p></div>
    <form className="activity-form" onSubmit={submit}>
      <label><span>Update type</span><select name="kind">{kinds.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label><span>Action needed from</span><select name="needsResponseFrom" defaultValue="none"><option value="none">No response needed</option>{viewer!=='client'&&<option value="client">Client</option>}{viewer!=='creator'&&<option value="creator">Studio Partner</option>}<option value="admin">Inchframe Studio</option></select></label>
      <label className="wide"><span>Short title</span><input name="title" required maxLength={140} placeholder="First cut ready / Need logo approval / Schedule risk"/></label>
      <label className="wide"><span>Update or message</span><textarea name="body" required maxLength={3000} rows={4}/></label>
      <label><span>Next step</span><input name="nextStep" maxLength={1000} placeholder="What happens next?"/></label>
      <label><span>Action or milestone date</span><input name="targetDate" type="date"/></label>
      <button className="button button-green wide" disabled={Boolean(busy)} type="submit">{busy==='post'?'Posting…':'Post to project log →'}</button>
    </form>
    {message&&<p className={message.includes('Could not')?'form-error':'success-message'} role="status">{message}</p>}
    {items.length===0?<p className="empty-line">No project updates yet. Start with a production kickoff message.</p>:<div className="activity-list">{items.map(item=>{const canResolve=!item.resolved_at&&item.needs_response_from!=='none'&&(viewer==='admin'||item.needs_response_from===viewer);return <article className={`activity-item kind-${item.kind} ${item.resolved_at?'resolved':''}`} key={item.id}><div className="activity-marker">{item.kind==='blocker'?'!':item.kind==='delivery'?'✓':'•'}</div><div><div className="activity-meta"><span>{item.kind.replaceAll('_',' ')}</span><b>{item.author_email}</b><small>{new Date(item.created_at).toLocaleString()}</small></div><h3>{item.title}</h3><p>{item.body}</p>{item.next_step&&<p className="next-step"><strong>Next:</strong> {item.next_step}</p>}<div className="activity-flags">{item.target_date&&<span>Target {item.target_date}</span>}{item.needs_response_from!=='none'&&<span className="action-flag">{item.resolved_at?'Resolved':`Action: ${item.needs_response_from}`}</span>}{canResolve&&<button className="mini-button approve" disabled={busy===item.id} onClick={()=>send({action:'resolve',activityId:item.id})}>{busy===item.id?'Resolving…':'Mark resolved'}</button>}</div></div></article>})}</div>}
  </div>;
}
