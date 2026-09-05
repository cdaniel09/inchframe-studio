import {NextResponse} from 'next/server';
import {createStudioSession,safeReturn,type ChatGPTUser} from '@/app/chatgpt-auth';
import {checkRateLimit,findStudioAccount,isEmailVerificationExempt,isStudioAdmin} from '@/lib/data';
import {PasswordWorkBusy,verifyPasswordAsync} from '@/lib/password';
import {LoginRequestError,readLoginForm} from '@/lib/login-request';
import {publicUrl} from '@/lib/public-url';
import {studioAuthMode,studioSsoConfigured} from '@/lib/account-sso';

export const runtime='nodejs';
function wantsJson(request:Request){return request.headers.get('accept')?.includes('application/json')===true;}
function redirectWith(request:Request,path:string){return NextResponse.redirect(publicUrl(request,path),303);}
function errorResponse(message:string,status:number,retryAfter?:number){
  return Response.json({error:message},{status,headers:{'cache-control':'no-store',...(retryAfter?{'retry-after':String(retryAfter)}:{})}});
}
function failure(request:Request,returnTo:string,message='That email or password was not recognized.',code='invalid'){
  return wantsJson(request)?errorResponse(message,401):
    redirectWith(request,`/login?error=${code}&returnTo=${encodeURIComponent(returnTo)}`);
}

export async function POST(request:Request){
  if(studioSsoConfigured()&&studioAuthMode()==='account')
    return errorResponse('Continue with Inchframe Account.',410);
  if(request.headers.get('sec-fetch-site')==='cross-site')return errorResponse('Cross-site request rejected.',403);
  // A shared cap cannot be bypassed by supplying a different forwarded IP header.
  if(!await checkRateLimit('native-login-global','all',60,60000))
    return errorResponse('Sign-in is busy. Please try again in a minute.',429,60);
  let form:FormData;
  try{form=await readLoginForm(request);}catch(error){
    return errorResponse(error instanceof Error?error.message:'Invalid sign-in request.',error instanceof LoginRequestError?error.status:400);
  }
  const emailValue=form.get('email'),passwordValue=form.get('password');
  if(typeof emailValue!=='string'||typeof passwordValue!=='string')
    return errorResponse('Enter your email and password.',400);
  const email=emailValue.trim().toLowerCase(),password=passwordValue;
  if(!email||email.length>254||!email.includes('@')||!password||password.length>512)
    return errorResponse('Enter a valid email and password.',400);
  const returnTo=safeReturn(String(form.get('returnTo')||'/portal'));
  if(!await checkRateLimit('native-login-email',email,5,15*60000))
    return errorResponse('Too many sign-in attempts. Please try again in 15 minutes, or continue with Inchframe Account if your profile is linked.',429,900);
  let user:ChatGPTUser|null=null;
  try {
    if(isStudioAdmin(email)){
      if(await verifyPasswordAsync(password,process.env.ADMIN_PASSWORD_HASH))
        user={userId:`admin:${email}`,email,displayName:'Studio Admin',fullName:'Studio Admin',role:'admin'};
    }else{
      const account=await findStudioAccount(email);
      const eligible=account&&!account.account_user_id&&account.auth_source!=='account'&&account.studio_access_status==='active';
      const valid=await verifyPasswordAsync(password,eligible?account.password_hash:undefined);
      if(eligible&&valid){
        if(!account.email_verified_at&&!isEmailVerificationExempt(account.email))
          return failure(request,returnTo,'Verify your email before signing in. Use “Resend the email” below to get a fresh verification link.','unverified');
        user={userId:account.id,email:account.email,displayName:account.display_name,fullName:account.display_name,role:'client'};
      }
    }
  } catch(error) {
    if(error instanceof PasswordWorkBusy)return errorResponse(error.message,503,1);
    throw error;
  }
  if(!user)return failure(request,returnTo);
  await createStudioSession(user);
  return wantsJson(request)?Response.json({redirectTo:returnTo},{headers:{'cache-control':'no-store'}}):redirectWith(request,returnTo);
}
