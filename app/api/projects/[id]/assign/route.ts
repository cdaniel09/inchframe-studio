import { getChatGPTUser } from '@/app/chatgpt-auth';
import { assignCreatorToProject,getCreatorApplicationById,getProjectForUser,isStudioAdmin } from '@/lib/data';
import { sendProjectWorkflowEmail } from '@/lib/email';

export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const user=await getChatGPTUser();
  if(!user||!isStudioAdmin(user))return Response.json({error:'Studio admin access required.'},{status:403});
  if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Cross-site request rejected.'},{status:403});
  const{id}=await params;
  const project=await getProjectForUser(id,user);
  if(!project)return Response.json({error:'Project not found.'},{status:404});
  let body:{creatorId?:string};try{body=await request.json() as {creatorId?:string};}catch{return Response.json({error:'Invalid request.'},{status:400});}
  const creatorId=String(body.creatorId||'').slice(0,100);
  const creator=await getCreatorApplicationById(creatorId);
  if(!creator)return Response.json({error:'Creator not found.'},{status:404});
  try{await assignCreatorToProject(id,creatorId);}catch(error){return Response.json({error:error instanceof Error?error.message:'Could not assign creator.'},{status:400});}
  try{await sendProjectWorkflowEmail({to:creator.owner_email,subject:`New private project request: ${project.title}`,heading:'A project is waiting for your quote.',message:'Review the essential brief, then send the customer-facing total and any scope note inside Studio.',projectId:id});}catch(error){console.error('Creator assignment email failed',error);}
  return Response.json({message:`Quote request sent to ${creator.display_name}.`});
}
