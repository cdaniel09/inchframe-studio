import {NextResponse} from 'next/server';
import {safeReturn} from '@/app/chatgpt-auth';
import {createAccountAuthorization,type StudioSsoIntent} from '@/lib/account-sso';
import {checkRateLimit} from '@/lib/data';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:Request){
  const query=new URL(request.url).searchParams;
  const returnTo=safeReturn(query.get('returnTo'));
  const requested=query.get('intent');
  const intent:StudioSsoIntent=requested==='studio_partner'||returnTo.startsWith('/studio-partners/apply')?'studio_partner':'customer';
  const clientIp=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  if(!await checkRateLimit('account-sso-start',clientIp,30,10*60*1000))
    return Response.json({error:'Too many sign-in attempts. Please try again shortly.'},{status:429,headers:{'cache-control':'no-store'}});
  try {
    const destination=await createAccountAuthorization(returnTo,intent);
    const response=NextResponse.redirect(destination,303);
    response.headers.set('cache-control','no-store');
    response.headers.set('referrer-policy','no-referrer');
    return response;
  } catch(error) {
    console.error('Account SSO start failed',error);
    return NextResponse.redirect(new URL(`/login?error=sso_config&returnTo=${encodeURIComponent(returnTo)}`,request.url),303);
  }
}
