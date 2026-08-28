import {NextResponse} from 'next/server';
import {createStudioSession} from '@/app/chatgpt-auth';
import {finishAccountAuthorization} from '@/lib/account-sso';
import {publicUrl} from '@/lib/public-url';

export const runtime='nodejs';
export const dynamic='force-dynamic';

function redirect(request:Request,path:string){
  const response=NextResponse.redirect(publicUrl(request,path),303);
  response.headers.set('cache-control','no-store');
  response.headers.set('referrer-policy','no-referrer');
  return response;
}

export async function GET(request:Request){
  const query=new URL(request.url).searchParams;
  if(query.get('error'))return redirect(request,'/login?error=sso_cancelled');
  try {
    const result=await finishAccountAuthorization(query.get('code')||'',query.get('state')||'');
    await createStudioSession(result.user);
    if(result.intent==='studio_partner'&&!result.identity.studioPartnerEligible)
      return redirect(request,'/studio-partners/apply?eligibility=required');
    return redirect(request,result.returnTo);
  } catch(error) {
    console.error('Account SSO callback failed',error);
    const message=error instanceof Error&&error.message.includes('suspended')?'suspended':'sso';
    return redirect(request,`/login?error=${message}`);
  }
}
