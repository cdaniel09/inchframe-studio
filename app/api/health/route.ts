import {ensureSchema} from '@/lib/data';
import {uploadRoot} from '@/lib/storage';
import {studioAuthMode,studioSsoConfigured} from '@/lib/account-sso';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(){
  const mode=studioAuthMode();
  const required=[
    'AUTH_SECRET','ADMIN_EMAIL',
    ...(mode==='account'?[]:['ADMIN_PASSWORD_HASH']),
    'SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS',
    ...(mode==='account'?['STUDIO_SSO_CLIENT_ID','STUDIO_SSO_CLIENT_SECRET','STUDIO_SSO_REDIRECT_URI']:[]),
  ];
  const missing=required.filter(key=>!process.env[key]);
  if(process.env.NODE_ENV==='production'&&missing.length)
    return Response.json({ok:false,error:'Studio configuration is incomplete.',missing},{status:503});
  try{
    await ensureSchema();
    return Response.json({ok:true,storage:uploadRoot(),email:'configured',authentication:{mode,accountSso:studioSsoConfigured()?'configured':'unavailable',sessionVersion:2,navigation:'fresh-request'},workflowVersion:8});
  }catch(error){
    console.error('Health check failed',error);
    return Response.json({ok:false,error:'Storage is unavailable.'},{status:503});
  }
}
