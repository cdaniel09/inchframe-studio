import 'server-only';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {consumeStudioSsoTransaction,createStudioSsoTransaction,type AccountSsoIdentity,upsertAccountSsoUser} from '@/lib/data';
import {hashToken} from '@/lib/tokens';

export type StudioSsoIntent='customer'|'studio_partner';

function setting(name:string,fallback=''){
  return (process.env[name]||fallback).trim();
}

export function studioSsoConfigured(){
  return Boolean(setting('STUDIO_SSO_CLIENT_ID')&&setting('STUDIO_SSO_CLIENT_SECRET')&&setting('STUDIO_SSO_REDIRECT_URI'));
}

export function studioAuthMode(){
  const mode=setting('STUDIO_AUTH_MODE','hybrid').toLowerCase();
  return mode==='account'||mode==='local'?mode:'hybrid';
}

export async function createAccountAuthorization(returnTo:string,intent:StudioSsoIntent){
  if(!studioSsoConfigured())throw new Error('Account sign-in is not configured.');
  const state=randomBytes(32).toString('base64url');
  const codeVerifier=randomBytes(48).toString('base64url');
  const codeChallenge=createHash('sha256').update(codeVerifier).digest('base64url');
  await createStudioSsoTransaction({
    stateHash:hashToken(state),codeVerifier,returnTo,intent,
    expiresAt:new Date(Date.now()+10*60*1000).toISOString(),
  });
  const authorize=new URL('/sso/authorize',setting('ACCOUNT_SSO_BASE_URL','https://account.inchframe.com'));
  authorize.searchParams.set('response_type','code');
  authorize.searchParams.set('client_id',setting('STUDIO_SSO_CLIENT_ID'));
  authorize.searchParams.set('redirect_uri',setting('STUDIO_SSO_REDIRECT_URI'));
  authorize.searchParams.set('state',state);
  authorize.searchParams.set('code_challenge',codeChallenge);
  authorize.searchParams.set('code_challenge_method','S256');
  authorize.searchParams.set('intent',intent);
  return authorize;
}

function constantTimeEqual(left:string,right:string){
  const a=Buffer.from(left),b=Buffer.from(right);
  return a.length===b.length&&timingSafeEqual(a,b);
}

export async function finishAccountAuthorization(code:string,state:string){
  if(!studioSsoConfigured())throw new Error('Account sign-in is not configured.');
  if(!/^[A-Za-z0-9_-]{32,256}$/.test(state)||!code)throw new Error('The Account sign-in request is invalid or expired.');
  const calculated=hashToken(state);
  const transaction=await consumeStudioSsoTransaction(calculated);
  if(!transaction||!constantTimeEqual(transaction.state_hash,calculated))throw new Error('The Account sign-in request is invalid or expired.');
  const body=new URLSearchParams({
    grant_type:'authorization_code',
    code,
    redirect_uri:setting('STUDIO_SSO_REDIRECT_URI'),
    client_id:setting('STUDIO_SSO_CLIENT_ID'),
    client_secret:setting('STUDIO_SSO_CLIENT_SECRET'),
    code_verifier:transaction.code_verifier,
  });
  let response:Response;
  try {
    response=await fetch(new URL('/api/sso/token',setting('ACCOUNT_SSO_BASE_URL','https://account.inchframe.com')),{
      method:'POST',
      headers:{accept:'application/json','content-type':'application/x-www-form-urlencoded'},
      body,
      cache:'no-store',
      signal:AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error('Inchframe Account could not complete sign-in. Please try again.');
  }
  const payload=await response.json().catch(()=>null) as {
    error?:string;error_description?:string;
    user?:{id?:string;email?:string;email_verified?:boolean;display_name?:string};
    roles?:unknown;
    entitlements?:{tier?:unknown;subscription_status?:unknown;studio_partner_eligible?:unknown;studio_partner_invite_id?:unknown;studio_partner_invite_expires_at?:unknown};
  }|null;
  if(!response.ok)throw new Error(response.status===429?'Account sign-in is temporarily busy. Please try again.':'Account sign-in expired. Please start again.');
  const source=payload?.user,entitlements=payload?.entitlements;
  if(!source?.id||!source.email||source.email_verified!==true||!source.display_name||!Array.isArray(payload?.roles)||!entitlements)
    throw new Error('Inchframe Account returned an incomplete identity.');
  const tier=entitlements.tier==='creator'||entitlements.tier==='pro'?entitlements.tier:null;
  const identity:AccountSsoIdentity={
    id:source.id,email:source.email,emailVerified:true,displayName:source.display_name,
    roles:payload.roles.filter((role):role is string=>typeof role==='string'),
    tier,subscriptionStatus:typeof entitlements.subscription_status==='string'?entitlements.subscription_status:'none',
    studioPartnerEligible:entitlements.studio_partner_eligible===true,
    studioPartnerInviteId:typeof entitlements.studio_partner_invite_id==='string'?entitlements.studio_partner_invite_id:null,
    studioPartnerInviteExpiresAt:typeof entitlements.studio_partner_invite_expires_at==='string'?entitlements.studio_partner_invite_expires_at:null,
  };
  const user=await upsertAccountSsoUser(identity);
  return {user,returnTo:transaction.return_to,intent:transaction.intent,identity};
}
