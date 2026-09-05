import 'server-only';
import {createHmac,timingSafeEqual} from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {createStudioSessionRecord,deleteStudioSession,findStudioSession} from '@/lib/data';
import { createOpaqueToken,hashToken } from '@/lib/tokens';

export type ChatGPTUser={userId:string;displayName:string;email:string;fullName:string|null;role:'admin'|'client'};
type SignedSession={user:ChatGPTUser;sid:string;issuedAt:number;expiresAt:number;version:3};
const SIGNED_COOKIE_NAME='inchframe_studio_auth_v3';
const COOKIE_NAME='inchframe_studio_session_v2';
const LEGACY_COOKIE_NAME='inchframe_studio_session';
const MAX_AGE=60*60*24*7;

function authSecret(){
  const secret=process.env.AUTH_SECRET;
  if(secret)return secret;
  if(process.env.NODE_ENV!=='production')return'inchframe-local-development-secret-change-me';
  throw new Error('AUTH_SECRET is not configured.');
}

function signature(value:string){return createHmac('sha256',authSecret()).update(`studio-session-v3:${value}`).digest('base64url');}
function safeEqual(left:string,right:string){const a=Buffer.from(left),b=Buffer.from(right);return a.length===b.length&&timingSafeEqual(a,b);}

function encodeSignedSession(user:ChatGPTUser,sid:string){
  const issuedAt=Date.now();
  const encoded=Buffer.from(JSON.stringify({user,sid,issuedAt,expiresAt:issuedAt+MAX_AGE*1000,version:3} satisfies SignedSession)).toString('base64url');
  return `${encoded}.${signature(encoded)}`;
}

function decodeSignedSession(value:string):SignedSession|null{
  const[encoded,supplied]=value.split('.');
  if(!encoded||!supplied||!safeEqual(signature(encoded),supplied))return null;
  try{
    const payload=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8')) as SignedSession;
    if(payload.version!==3||payload.expiresAt<=Date.now()||!payload.sid||!payload.user?.userId||!payload.user.email)return null;
    return payload;
  }catch{return null;}
}

function opaqueSessionTokens(values:string[]){
  return [...new Set(values)].filter(value=>/^[A-Za-z0-9_-]{32,256}$/.test(value)).slice(0,8);
}

export async function getChatGPTUser():Promise<ChatGPTUser|null>{
  const cookieStore=await cookies();
  for(const cookie of cookieStore.getAll(SIGNED_COOKIE_NAME)){
    const session=decodeSignedSession(cookie.value);
    if(!session)continue;
    const user=await findStudioSession(hashToken(session.sid));
    if(user&&user.userId===session.user.userId)return user;
  }
  const values=[
    ...cookieStore.getAll(COOKIE_NAME).map(cookie=>cookie.value),
    ...cookieStore.getAll(LEGACY_COOKIE_NAME).map(cookie=>cookie.value),
  ];
  for(const value of opaqueSessionTokens(values)){
    const user=await findStudioSession(hashToken(value));
    if(user)return user;
  }
  return null;
}

export async function createStudioSession(user:ChatGPTUser,accountSessionToken?:string){
  const sid=createOpaqueToken();
  await createStudioSessionRecord(hashToken(sid),user,new Date(Date.now()+MAX_AGE*1000).toISOString(),accountSessionToken);
  const cookieStore=await cookies();
  cookieStore.set(SIGNED_COOKIE_NAME,encodeSignedSession(user,sid),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:MAX_AGE});
  cookieStore.set(COOKIE_NAME,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});
  clearLegacyCookies(cookieStore);
}

function clearLegacyCookies(cookieStore:Awaited<ReturnType<typeof cookies>>){
  for(const path of ['/','/api','/api/auth'])
    cookieStore.set(LEGACY_COOKIE_NAME,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path,maxAge:0});
}

export async function clearStudioSession(){
  const cookieStore=await cookies();
  const signed=cookieStore.getAll(SIGNED_COOKIE_NAME).map(cookie=>decodeSignedSession(cookie.value)).filter((session):session is SignedSession=>Boolean(session));
  const values=[
    ...cookieStore.getAll(COOKIE_NAME).map(cookie=>cookie.value),
    ...cookieStore.getAll(LEGACY_COOKIE_NAME).map(cookie=>cookie.value),
  ];
  await Promise.all([...signed.map(session=>session.sid),...opaqueSessionTokens(values)].map(value=>deleteStudioSession(hashToken(value))));
  cookieStore.set(SIGNED_COOKIE_NAME,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});
  cookieStore.set(COOKIE_NAME,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});
  clearLegacyCookies(cookieStore);
}

export async function requireChatGPTUser(returnTo:string){const user=await getChatGPTUser();if(user)return user;redirect(`/login?returnTo=${encodeURIComponent(safeReturn(returnTo))}&error=session`);}

export function chatGPTSignOutPath(returnTo='/'){return `/api/auth/logout?returnTo=${encodeURIComponent(safeReturn(returnTo))}`;}

export function safeReturn(value:string|null|undefined){if(!value||!value.startsWith('/')||value.startsWith('//'))return'/portal';try{const url=new URL(value,'https://studio.local');if(url.origin!=='https://studio.local')return'/portal';if(['/login','/register','/api/auth/logout'].includes(url.pathname))return'/portal';return`${url.pathname}${url.search}${url.hash}`;}catch{return'/portal';}}
