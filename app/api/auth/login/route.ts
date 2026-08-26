import { NextResponse } from 'next/server';
import { createStudioSession, safeReturn, type ChatGPTUser } from '@/app/chatgpt-auth';
import { findStudioAccount, isStudioAdmin } from '@/lib/data';
import { verifyPassword } from '@/lib/password';
import { publicUrl } from '@/lib/public-url';

export const runtime='nodejs';
function wantsJson(request:Request){return request.headers.get('accept')?.includes('application/json')===true;}
function redirectWith(request:Request,path:string){return NextResponse.redirect(publicUrl(request,path),303);}
function failure(request:Request,returnTo:string,message='That email or password was not recognized.',code='invalid'){return wantsJson(request)?Response.json({error:message},{status:401,headers:{'cache-control':'no-store'}}):redirectWith(request,`/login?error=${code}&returnTo=${encodeURIComponent(returnTo)}`);}

export async function POST(request:Request) {
  if(request.headers.get('sec-fetch-site')==='cross-site') return Response.json({error:'Cross-site request rejected.'},{status:403});
  let form:FormData;
  try{form=await request.formData();}catch{return Response.json({error:'Invalid sign-in request.'},{status:400});}
  const email=String(form.get('email')||'').trim().toLowerCase().slice(0,254);
  const password=String(form.get('password')||'').slice(0,512);
  const returnTo=safeReturn(String(form.get('returnTo')||'/portal'));
  let user:ChatGPTUser|null=null;
  if(isStudioAdmin(email)) {
    if(verifyPassword(password,process.env.ADMIN_PASSWORD_HASH)) user={userId:`admin:${email}`,email,displayName:'Studio Admin',fullName:'Studio Admin',role:'admin'};
  } else {
    const account=await findStudioAccount(email);
    if(account && verifyPassword(password,account.password_hash)) {
      if(!account.email_verified_at) return failure(request,returnTo,'Verify your email before signing in. You can resend the verification message from the signup screen.','unverified');
      user={userId:account.id,email:account.email,displayName:account.display_name,fullName:account.display_name,role:'client'};
    }
  }
  if(!user) return failure(request,returnTo);
  await createStudioSession(user);
  return wantsJson(request)?Response.json({redirectTo:returnTo},{headers:{'cache-control':'no-store'}}):redirectWith(request,returnTo);
}
