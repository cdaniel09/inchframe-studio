import { NextResponse } from 'next/server';
import { checkRateLimit, createStudioAccount, findStudioAccount, isStudioAdmin } from '@/lib/data';
import { sendVerificationEmail } from '@/lib/email';
import { hashPassword } from '@/lib/password';
import { publicUrl } from '@/lib/public-url';
import { createOpaqueToken, hashToken } from '@/lib/tokens';

export const runtime='nodejs';
function wantsJson(request:Request){return request.headers.get('accept')?.includes('application/json')===true;}
function redirectWith(request:Request,path:string){return NextResponse.redirect(publicUrl(request,path),303);}
function failure(request:Request,code:'fields'|'exists'|'rate'|'email',message:string,status=400){return wantsJson(request)?Response.json({error:message},{status,headers:{'cache-control':'no-store'}}):redirectWith(request,`/register?error=${code}`);}
function clientIp(request:Request){return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';}

export async function POST(request:Request) {
  if(request.headers.get('sec-fetch-site')==='cross-site') return Response.json({error:'Cross-site request rejected.'},{status:403});
  let form:FormData;
  try{form=await request.formData();}catch{return Response.json({error:'Invalid registration request.'},{status:400});}
  const displayName=String(form.get('displayName')||'').trim().slice(0,100);
  const email=String(form.get('email')||'').trim().toLowerCase().slice(0,254);
  const password=String(form.get('password')||'').slice(0,512);
  const honeypot=String(form.get('companyWebsite')||'').trim();
  if(honeypot) return wantsJson(request)?Response.json({redirectTo:`/verify-email?email=${encodeURIComponent(email)}`},{headers:{'cache-control':'no-store'}}):redirectWith(request,'/verify-email');
  if(!displayName || !email.includes('@') || password.length<10) return failure(request,'fields','Enter your name, a valid email, and a password of at least 10 characters.');
  const allowed=await checkRateLimit('register-ip',clientIp(request),5,60*60*1000);
  if(!allowed) return failure(request,'rate','Too many signup attempts. Please try again later.',429);
  if(isStudioAdmin(email) || await findStudioAccount(email)) return failure(request,'exists','An account with that email already exists. Try signing in instead.');
  const token=createOpaqueToken();
  const expiresAt=new Date(Date.now()+24*60*60*1000).toISOString();
  try {
    await createStudioAccount({email,displayName,passwordHash:hashPassword(password),verificationTokenHash:hashToken(token),verificationExpiresAt:expiresAt});
  } catch {
    return failure(request,'exists','An account with that email already exists. Try signing in instead.');
  }
  try {
    await sendVerificationEmail({email,displayName,token});
  } catch(error) {
    console.error('Verification email failed',error);
    return failure(request,'email','Your account was created, but the verification email could not be sent. Use resend verification in a moment.',503);
  }
  const redirectTo=`/verify-email?email=${encodeURIComponent(email)}`;
  return wantsJson(request)?Response.json({redirectTo},{headers:{'cache-control':'no-store'}}):redirectWith(request,redirectTo);
}
