import {getChatGPTUser} from '@/app/chatgpt-auth';
import {getStudioAccountById,isStudioAdmin,revokeStudioUserSessions,setStudioUserAccess} from '@/lib/data';

export const runtime='nodejs';

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const admin=await getChatGPTUser();
  if(!admin||!isStudioAdmin(admin))return Response.json({error:'Studio admin access required.'},{status:403});
  if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Cross-site request rejected.'},{status:403});
  const origin=request.headers.get('origin');
  if(!origin||origin!==new URL(request.url).origin)return Response.json({error:'Cross-origin request rejected.'},{status:403});
  const{id}=await params,target=await getStudioAccountById(id);
  if(!target)return Response.json({error:'Studio user not found.'},{status:404});
  if(target.id===admin.userId||target.studio_admin_claim===1||isStudioAdmin(target.email))
    return Response.json({error:'Administrator access cannot be changed here.'},{status:400});
  let body:{action?:string};
  try{body=await request.json() as {action?:string};}catch{return Response.json({error:'Invalid request.'},{status:400});}
  if(body.action==='suspend')await setStudioUserAccess(id,'suspended');
  else if(body.action==='restore')await setStudioUserAccess(id,'active');
  else if(body.action==='revoke_sessions')await revokeStudioUserSessions(id);
  else return Response.json({error:'Invalid user action.'},{status:400});
  return Response.json({message:body.action==='suspend'?'Studio access suspended.':body.action==='restore'?'Studio access restored.':'Studio sessions revoked.'});
}
