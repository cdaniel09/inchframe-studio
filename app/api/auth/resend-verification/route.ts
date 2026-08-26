import { checkRateLimit, findStudioAccount, refreshVerificationToken } from '@/lib/data';
import { sendVerificationEmail } from '@/lib/email';
import { createOpaqueToken, hashToken } from '@/lib/tokens';

export const runtime='nodejs';
export async function POST(request:Request) {
  if(request.headers.get('sec-fetch-site')==='cross-site') return Response.json({error:'Cross-site request rejected.'},{status:403});
  let form:FormData;
  try{form=await request.formData();}catch{return Response.json({error:'Invalid request.'},{status:400});}
  const email=String(form.get('email')||'').trim().toLowerCase().slice(0,254);
  if(!email.includes('@')) return Response.json({error:'Enter a valid email address.'},{status:400});
  const allowed=await checkRateLimit('verify-resend',email,3,60*60*1000);
  if(!allowed) return Response.json({error:'Too many resend requests. Please wait an hour and try again.'},{status:429});
  const account=await findStudioAccount(email);
  if(account && !account.email_verified_at) {
    const token=createOpaqueToken();
    const expiresAt=new Date(Date.now()+24*60*60*1000).toISOString();
    await refreshVerificationToken(email,hashToken(token),expiresAt);
    try{await sendVerificationEmail({email,displayName:account.display_name,token});}
    catch(error){console.error('Verification resend failed',error);return Response.json({error:'The verification email could not be sent. Please try again shortly.'},{status:503});}
  }
  return Response.json({message:'If that account is waiting for verification, a new email is on the way.'},{headers:{'cache-control':'no-store'}});
}
