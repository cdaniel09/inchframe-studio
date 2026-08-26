import { NextResponse } from 'next/server';
import { createStudioSession, type ChatGPTUser } from '@/app/chatgpt-auth';
import { createStudioAccount, findStudioAccount, isStudioAdmin } from '@/lib/data';
import { hashPassword, secretsEqual } from '@/lib/password';
import { publicUrl } from '@/lib/public-url';

export const runtime = 'nodejs';

function wantsJson(request:Request){return request.headers.get('accept')?.includes('application/json')===true;}
function redirectWith(request:Request,path:string){return NextResponse.redirect(publicUrl(request,path),303);}
function failure(request:Request,code:'access'|'fields'|'exists',message:string){return wantsJson(request)?Response.json({error:message},{status:code==='access'?403:400,headers:{'cache-control':'no-store'}}):redirectWith(request,`/register?error=${code}`);}

export async function POST(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return Response.json({error:'Cross-site request rejected.'},{status:403});
  let form:FormData;
  try{form=await request.formData();}catch{return Response.json({error:'Invalid registration request.'},{status:400});}
  const displayName = String(form.get('displayName') || '').trim().slice(0, 100);
  const email = String(form.get('email') || '').trim().toLowerCase().slice(0, 254);
  const password = String(form.get('password') || '').slice(0, 512);
  const accessCode = String(form.get('accessCode') || '').slice(0, 512);

  if (!secretsEqual(accessCode, process.env.CLIENT_SIGNUP_CODE)) return failure(request,'access','That client access code is not valid.');
  if (!displayName || !email.includes('@') || password.length < 10) return failure(request,'fields','Enter your name, a valid email, and a password of at least 10 characters.');
  if (isStudioAdmin(email) || await findStudioAccount(email)) return failure(request,'exists','An account with that email already exists. Try signing in instead.');

  try {
    const id = await createStudioAccount({email, displayName, passwordHash: hashPassword(password)});
    const user: ChatGPTUser = {userId: id, email, displayName, fullName: displayName, role: 'client'};
    await createStudioSession(user);
    return wantsJson(request)?Response.json({redirectTo:'/start'},{headers:{'cache-control':'no-store'}}):redirectWith(request,'/start');
  } catch {
    return failure(request,'exists','An account with that email already exists. Try signing in instead.');
  }
}
