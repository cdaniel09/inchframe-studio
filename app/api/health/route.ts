import { ensureSchema } from '@/lib/data';
import { uploadRoot } from '@/lib/storage';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){const missing=['AUTH_SECRET','ADMIN_EMAIL','ADMIN_PASSWORD_HASH','SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS'].filter(key=>!process.env[key]);if(process.env.NODE_ENV==='production'&&missing.length)return Response.json({ok:false,error:'Studio configuration is incomplete.',missing},{status:503});try{await ensureSchema();return Response.json({ok:true,storage:uploadRoot(),email:'configured'});}catch(error){console.error('Health check failed',error);return Response.json({ok:false,error:'Storage is unavailable.'},{status:503});}}
