'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import type {ProjectEssentials} from '@/lib/data';

export function ProjectRequestEditor({projectId,current,pending}:{projectId:string;current:ProjectEssentials;pending:ProjectEssentials|null}){
  const router=useRouter();
  const[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const values=pending||current;
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setMessage('');setError('');
    const data=new FormData(event.currentTarget);
    try{
      const response=await fetch(`/api/projects/${projectId}/changes`,{method:'POST',headers:{'content-type':'application/json'},credentials:'include',body:JSON.stringify({action:'submit',title:data.get('title'),projectType:data.get('projectType'),brief:data.get('brief'),audience:data.get('audience'),platforms:data.get('platforms'),dueDate:data.get('dueDate'),budgetRange:data.get('budgetRange')})});
      const result=await response.json() as {error?:string;message?:string};
      if(!response.ok)throw new Error(result.error||'Could not submit project changes.');
      setMessage(result.message||'Changes sent for review.');router.refresh();
    }catch(reason){setError(reason instanceof Error?reason.message:'Could not submit project changes.');}finally{setBusy(false);}
  }
  return <div className="request-editor">
    {pending&&<div className="change-notice"><strong>Changes waiting for Studio review</strong><p>You can revise the proposed values again while they are pending. The current project remains unchanged until Studio accepts them.</p></div>}
    <form className="request-edit-form" onSubmit={submit}>
      <label><span>Project title</span><input name="title" required maxLength={120} defaultValue={values.title}/></label>
      <label><span>Project type</span><select name="projectType" required defaultValue={values.projectType}><option value="brand_film">Brand or product film</option><option value="music_video">Music video</option><option value="visualizer">Visualizer</option><option value="launch_clip">Launch clip</option><option value="other">Other</option></select></label>
      <label className="wide"><span>What should the video communicate?</span><textarea name="brief" required maxLength={1500} rows={5} defaultValue={values.brief}/></label>
      <label><span>Who is it for?</span><input name="audience" maxLength={300} defaultValue={values.audience}/></label>
      <label><span>Where will it run?</span><input name="platforms" maxLength={300} defaultValue={values.platforms}/></label>
      <label><span>Ideal delivery date</span><input name="dueDate" type="date" defaultValue={values.dueDate||''}/></label>
      <label><span>Working budget</span><select name="budgetRange" required defaultValue={values.budgetRange}><option value="under_500">Under $500</option><option value="500_1000">$500–$1,000</option><option value="1000_2500">$1,000–$2,500</option><option value="2500_5000">$2,500–$5,000</option><option value="5000_plus">$5,000+</option></select></label>
      <div className="request-edit-submit wide"><div>{error&&<p className="form-error" role="alert">{error}</p>}{message&&<p className="control-message good" role="status">{message}</p>}</div><button className="button button-green" disabled={busy} type="submit">{busy?'Submitting…':pending?'Update proposed changes →':'Request changes →'}</button></div>
    </form>
  </div>;
}
