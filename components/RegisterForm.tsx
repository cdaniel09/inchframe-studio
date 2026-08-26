'use client';
import { useState } from 'react';

const errors:Record<string,string>={access:'That client access code is not valid.',fields:'Enter your name, a valid email, and a password of at least 10 characters.',exists:'An account with that email already exists. Try signing in instead.'};

export function RegisterForm({initialError}:{initialError?:string}) {
  const [error,setError]=useState(initialError?errors[initialError]||'Could not create your account.':'');
  const [busy,setBusy]=useState(false);

  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response=await fetch('/api/auth/register',{
        method:'POST',
        body:new FormData(event.currentTarget),
        credentials:'include',
        headers:{accept:'application/json','x-requested-with':'InchframeStudio'},
        cache:'no-store',
      });
      const result=await response.json() as {redirectTo?:string;error?:string};
      if(!response.ok||!result.redirectTo)throw new Error(result.error||'Could not create your account.');
      window.location.assign(result.redirectTo);
    } catch(reason) {
      setError(reason instanceof Error?reason.message:'Could not create your account.');
      setBusy(false);
    }
  }

  return <form className="auth-card" onSubmit={submit}><span className="card-code">CREATE CLIENT ACCESS</span><h2>Open your workspace.</h2>{error&&<p className="form-error" role="alert">{error}</p>}<label><span>Your name</span><input name="displayName" autoComplete="name" required maxLength={100}/></label><label><span>Email</span><input name="email" type="email" autoComplete="email" required/></label><label><span>Password</span><input name="password" type="password" autoComplete="new-password" minLength={10} required/></label><label><span>Studio access code</span><input name="accessCode" type="password" autoComplete="off" required/></label><button className="button button-green" disabled={busy} type="submit">{busy?'Creating access…':'Create client area →'}</button><p>Already registered? <a href="/login">Sign in.</a></p></form>;
}
