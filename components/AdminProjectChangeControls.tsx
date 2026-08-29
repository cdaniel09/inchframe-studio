'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import type {ProjectEssentials} from '@/lib/data';

const labels:Record<keyof ProjectEssentials,string>={title:'Title',projectType:'Project type',brief:'Brief',audience:'Audience',platforms:'Platforms',dueDate:'Target date',budgetRange:'Budget'};
export function AdminProjectChangeControls({projectId,current,pending}:{projectId:string;current:ProjectEssentials;pending:ProjectEssentials}){
  const router=useRouter();const[busy,setBusy]=useState(false),[error,setError]=useState(''),[note,setNote]=useState('');
  const changed=(Object.keys(labels) as (keyof ProjectEssentials)[]).filter(key=>current[key]!==pending[key]);
  async function review(action:'approve'|'decline'){
    setBusy(true);setError('');
    try{const response=await fetch(`/api/projects/${projectId}/changes`,{method:'POST',headers:{'content-type':'application/json'},credentials:'include',body:JSON.stringify({action,note})});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||'Could not review changes.');router.refresh();}
    catch(reason){setError(reason instanceof Error?reason.message:'Could not review changes.');setBusy(false);}
  }
  return <div className="admin-change-review"><div className="change-notice admin"><strong>Client changes need acceptance</strong><p>The live project keeps its current values until you approve this request.</p></div><div className="change-diff-list">{changed.map(key=><div key={key}><span>{labels[key]}</span><p><del>{String(current[key]||'Not specified')}</del><b>→</b><ins>{String(pending[key]||'Not specified')}</ins></p></div>)}</div><label><span>Studio note (optional)</span><textarea rows={3} maxLength={800} value={note} onChange={event=>setNote(event.target.value)}/></label>{error&&<p className="form-error" role="alert">{error}</p>}<div className="review-actions"><button className="mini-button approve" disabled={busy} onClick={()=>void review('approve')} type="button">Accept client changes</button><button className="mini-button warn" disabled={busy} onClick={()=>void review('decline')} type="button">Decline changes</button></div></div>;
}
