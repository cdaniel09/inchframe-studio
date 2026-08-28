'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';

export function AdminUserControls({id,suspended,protectedAccount}:{id:string;suspended:boolean;protectedAccount:boolean}){
  const router=useRouter(),[busy,setBusy]=useState(''),[message,setMessage]=useState('');
  async function act(action:'suspend'|'restore'|'revoke_sessions'){
    if(action==='suspend'&&!window.confirm('Suspend this user’s Studio access and revoke all Studio sessions?'))return;
    setBusy(action);setMessage('');
    try{
      const response=await fetch(`/api/admin/users/${id}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action}),credentials:'include'});
      const result=await response.json() as {error?:string;message?:string};
      if(!response.ok)throw new Error(result.error||'Could not update this Studio user.');
      setMessage(result.message||'Updated.');router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:'Could not update this Studio user.');}
    finally{setBusy('');}
  }
  if(protectedAccount)return <p className="user-action-note">Administrator account · protected</p>;
  return <div className="user-action-controls">
    <button className="mini-button" disabled={Boolean(busy)} onClick={()=>act('revoke_sessions')}>{busy==='revoke_sessions'?'Revoking…':'Revoke sessions'}</button>
    <button className={`mini-button ${suspended?'':'danger'}`} disabled={Boolean(busy)} onClick={()=>act(suspended?'restore':'suspend')}>{busy?(suspended?'Restoring…':'Suspending…'):suspended?'Restore access':'Suspend access'}</button>
    {message&&<small role="status">{message}</small>}
  </div>;
}
