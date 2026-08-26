'use client';
import { useState } from 'react';

export function LoginForm({returnTo,initialError=false,unverified=false}:{returnTo:string;initialError?:boolean;unverified?:boolean}) {
  const[error,setError]=useState(unverified?'Verify your email before signing in.':initialError?'That email or password was not recognized.':'');
  const[busy,setBusy]=useState(false);
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('');
    try {
      const response=await fetch('/api/auth/login',{method:'POST',body:new FormData(event.currentTarget),credentials:'include',headers:{accept:'application/json','x-requested-with':'InchframeStudio'},cache:'no-store'});
      const result=await response.json() as {redirectTo?:string;error?:string};
      if(!response.ok||!result.redirectTo)throw new Error(result.error||'Could not sign in.');
      window.location.assign(result.redirectTo);
    } catch(reason){setError(reason instanceof Error?reason.message:'Could not sign in.');setBusy(false);}
  }
  return <form className="auth-card" onSubmit={submit}><span className="card-code">SECURE SIGN IN</span><h2>Welcome back.</h2>{error&&<p className="form-error" role="alert">{error}</p>}<input type="hidden" name="returnTo" value={returnTo}/><label><span>Email</span><input name="email" type="email" autoComplete="email" required/></label><label><span>Password</span><input name="password" type="password" autoComplete="current-password" required/></label><button className="button button-green" disabled={busy} type="submit">{busy?'Signing in…':'Sign in →'}</button><p>New client? <a href="/register">Create an account.</a></p><p>Waiting on verification? <a href="/verify-email">Resend the email.</a></p></form>;
}
