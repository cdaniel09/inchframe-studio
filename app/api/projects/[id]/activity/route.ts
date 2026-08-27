import { getChatGPTUser } from '@/app/chatgpt-auth';
import { addProjectActivity,getProjectBundle,isStudioAdmin,resolveProjectActivity,type ProjectActivity } from '@/lib/data';
import { sendProjectWorkflowEmail } from '@/lib/email';

export const runtime='nodejs';
const kinds=new Set<ProjectActivity['kind']>(['message','progress','milestone','decision','blocker','delivery']);
const roles=new Set<ProjectActivity['needs_response_from']>(['none','creator','client','admin']);
const text=(value:unknown,max:number)=>typeof value==='string'?value.trim().slice(0,max):'';

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in required.'},{status:401});
  if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Cross-site request rejected.'},{status:403});
  const{id}=await params,bundle=await getProjectBundle(id,user);if(!bundle)return Response.json({error:'Project not found.'},{status:404});
  let body:Record<string,unknown>;try{body=await request.json() as Record<string,unknown>;}catch{return Response.json({error:'Invalid request.'},{status:400});}
  try{
    if(body.action==='resolve'){
      await resolveProjectActivity(id,text(body.activityId,100),user);
      return Response.json({message:'Action item resolved.'});
    }
    const kind=kinds.has(body.kind as ProjectActivity['kind'])?body.kind as ProjectActivity['kind']:'message';
    const needsResponseFrom=roles.has(body.needsResponseFrom as ProjectActivity['needs_response_from'])?body.needsResponseFrom as ProjectActivity['needs_response_from']:'none';
    const targetDate=typeof body.targetDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(body.targetDate)?body.targetDate:null;
    const input={kind,title:text(body.title,140),body:text(body.body,3000),nextStep:text(body.nextStep,1000),needsResponseFrom,targetDate};
    await addProjectActivity(user,id,input);
    const adminEmail=process.env.INQUIRY_NOTIFICATION_EMAIL?.trim()||process.env.ADMIN_EMAIL?.trim();
    const recipient=needsResponseFrom==='client'?bundle.project.owner_email:needsResponseFrom==='creator'?bundle.quote?.creator.owner_email:needsResponseFrom==='admin'?adminEmail:undefined;
    const message=`${input.body}${input.nextStep?`\n\nNext: ${input.nextStep}`:''}`;
    if(!isStudioAdmin(user)&&adminEmail)try{await sendProjectWorkflowEmail({to:adminEmail,subject:`Project activity: ${bundle.project.title}`,heading:`${user.displayName} posted ${kind.replaceAll('_',' ')}.`,message:`${input.title}\n\n${message}`,projectId:id});}catch(error){console.error('Admin activity notification failed',error);}
    if(recipient&&!(recipient===adminEmail&&!isStudioAdmin(user)))try{await sendProjectWorkflowEmail({to:recipient,subject:`Action needed: ${bundle.project.title}`,heading:input.title,message,projectId:id});}catch(error){console.error('Project activity email failed',error);}
    return Response.json({message:isStudioAdmin(user)&&needsResponseFrom==='admin'?'Admin action logged.':'Project update posted.'});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Could not update the project log.'},{status:400});}
}
