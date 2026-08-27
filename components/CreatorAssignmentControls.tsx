'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CreatorAssignmentControls({projectId,creators}:{projectId:string;creators:{id:string;displayName:string;minimum:number}[]}){
  const router=useRouter();const[busy,setBusy]=useState(false);const[message,setMessage]=useState('');
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setMessage('');const form=new FormData(event.currentTarget);
    try{
      const response=await fetch(`/api/projects/${projectId}/assign`,{method:'POST',credentials:'include',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({creatorId:form.get('creatorId')})});
      const result=await response.json() as {message?:string;error?:string};if(!response.ok)throw new Error(result.error||'Could not assign Studio Partner.');
      setMessage(result.message||'Studio Partner assigned.');router.refresh();
    }catch(reason){setMessage(reason instanceof Error?reason.message:'Could not assign Studio Partner.');}
    finally{setBusy(false);}
  }
  return <form className="admin-review assignment-control" onSubmit={submit}>
    <div><strong>Route to one Studio Partner</strong><p>The Studio Partner—not the admin—sets the customer-facing quote. This is a direct private request.</p></div>
    {creators.length?<><label><span>Eligible Studio Partner</span><select name="creatorId" required defaultValue=""><option value="" disabled>Select Studio Partner</option>{creators.map(creator=><option value={creator.id} key={creator.id}>{creator.displayName} · from ${creator.minimum.toLocaleString('en-US')}</option>)}</select></label><button className="mini-button approve" disabled={busy} type="submit">{busy?'Routing…':'Send private quote request'}</button></>:<p className="form-error">No approved Studio Partners have completed every verification check.</p>}
    {message&&<p className="control-message" role="status">{message}</p>}
  </form>;
}
