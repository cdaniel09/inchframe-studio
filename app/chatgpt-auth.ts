import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createStudioSessionRecord,deleteStudioSession,findStudioSession } from '@/lib/data';
import { createOpaqueToken,hashToken } from '@/lib/tokens';

export type ChatGPTUser={userId:string;displayName:string;email:string;fullName:string|null;role:'admin'|'client'};
const COOKIE_NAME='inchframe_studio_session_v2';
const LEGACY_COOKIE_NAME='inchframe_studio_session';
const MAX_AGE=60*60*24*7;

function opaqueSessionTokens(values:string[]){
  return [...new Set(values)].filter(value=>/^[A-Za-z0-9_-]{32,256}$/.test(value)).slice(0,8);
}

export async function getChatGPTUser():Promise<ChatGPTUser|null>{
  const cookieStore=await cookies();
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

export async function createStudioSession(user:ChatGPTUser){
  const token=createOpaqueToken();
  await createStudioSessionRecord(hashToken(token),user,new Date(Date.now()+MAX_AGE*1000).toISOString());
  const cookieStore=await cookies();
  cookieStore.set(COOKIE_NAME,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:MAX_AGE});
  clearLegacyCookies(cookieStore);
}

function clearLegacyCookies(cookieStore:Awaited<ReturnType<typeof cookies>>){
  for(const path of ['/','/api','/api/auth'])
    cookieStore.set(LEGACY_COOKIE_NAME,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path,maxAge:0});
}

export async function clearStudioSession(){
  const cookieStore=await cookies();
  const values=[
    ...cookieStore.getAll(COOKIE_NAME).map(cookie=>cookie.value),
    ...cookieStore.getAll(LEGACY_COOKIE_NAME).map(cookie=>cookie.value),
  ];
  await Promise.all(opaqueSessionTokens(values).map(value=>deleteStudioSession(hashToken(value))));
  cookieStore.set(COOKIE_NAME,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});
  clearLegacyCookies(cookieStore);
}

export async function requireChatGPTUser(returnTo:string){const user=await getChatGPTUser();if(user)return user;redirect(`/login?returnTo=${encodeURIComponent(safeReturn(returnTo))}&error=session`);}

export function chatGPTSignOutPath(returnTo='/'){return `/api/auth/logout?returnTo=${encodeURIComponent(safeReturn(returnTo))}`;}

export function safeReturn(value:string|null|undefined){if(!value||!value.startsWith('/')||value.startsWith('//'))return'/portal';try{const url=new URL(value,'https://studio.local');if(url.origin!=='https://studio.local')return'/portal';if(['/login','/register','/api/auth/logout'].includes(url.pathname))return'/portal';return`${url.pathname}${url.search}${url.hash}`;}catch{return'/portal';}}
