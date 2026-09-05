import 'server-only';

// Do not cache a positive result: a completed Account reset must affect the next request.
export async function inspectAccountSession(token:string):Promise<{active:boolean;account_id?:string;roles?:string[]}|null> {
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))return {active:false};
  const clientId=process.env.STUDIO_SSO_CLIENT_ID,secret=process.env.STUDIO_SSO_CLIENT_SECRET;
  if(!clientId||!secret)return null;
  try {
    const response=await fetch(new URL('/api/sso/session',process.env.ACCOUNT_SSO_BASE_URL||'https://account.inchframe.com'),{
      method:'POST',headers:{accept:'application/json','content-type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({client_id:clientId,client_secret:secret,session_token:token}),
      cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000),
    });
    if(!response.ok)return null;
    const result=await response.json();
    if(result?.active===false)return {active:false};
    if(result?.active!==true||typeof result.account_id!=='string'||!Array.isArray(result.roles))return null;
    return {active:true,account_id:result.account_id,roles:result.roles.filter((role:unknown)=>typeof role==='string')};
  } catch {return null;}
}
