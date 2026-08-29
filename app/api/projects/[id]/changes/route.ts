import {getChatGPTUser} from '@/app/chatgpt-auth';
import {getProjectForUser,isStudioAdmin,reviewProjectEssentialsChange,submitProjectEssentialsChange} from '@/lib/data';
import {sendProjectWorkflowEmail} from '@/lib/email';

type ChangeBody={action?:string;title?:unknown;projectType?:unknown;brief?:unknown;audience?:unknown;platforms?:unknown;dueDate?:unknown;budgetRange?:unknown;note?:unknown};
function clean(value:unknown,max:number){return typeof value==='string'?value.trim().slice(0,max):'';}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:'Your session is no longer valid. Sign in again to continue.'},{status:401});
  if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Cross-site request rejected.'},{status:403});
  const{id}=await params;
  let body:ChangeBody;
  try{body=await request.json() as ChangeBody;}catch{return Response.json({error:'Invalid change request.'},{status:400});}

  if(body.action==='submit'){
    const title=clean(body.title,120),projectType=clean(body.projectType,40),brief=clean(body.brief,1500);
    const audience=clean(body.audience,300),platforms=clean(body.platforms,300),budgetRange=clean(body.budgetRange,40);
    const dueDate=clean(body.dueDate,10);
    if(!title||!projectType||!brief||!budgetRange)return Response.json({error:'Title, project type, brief, and budget are required.'},{status:400});
    if(!['music_video','visualizer','brand_film','launch_clip','other'].includes(projectType))return Response.json({error:'Invalid project type.'},{status:400});
    if(!['under_500','500_1000','1000_2500','2500_5000','5000_plus'].includes(budgetRange))return Response.json({error:'Invalid project budget.'},{status:400});
    if(dueDate&&!/^\d{4}-\d{2}-\d{2}$/.test(dueDate))return Response.json({error:'Invalid delivery date.'},{status:400});
    try{
      const fields=await submitProjectEssentialsChange(id,user,{title,projectType,brief,audience,platforms,dueDate:dueDate||null,budgetRange});
      const adminEmail=process.env.INQUIRY_NOTIFICATION_EMAIL?.trim()||process.env.ADMIN_EMAIL?.trim();
      if(adminEmail)try{await sendProjectWorkflowEmail({to:adminEmail,subject:`Client changes waiting: ${title}`,heading:'A client changed a project request.',message:`${user.displayName} changed: ${fields.join(', ')}. Review and accept or decline the proposed values in Studio.`,projectId:id});}catch(error){console.error('Client change notification failed',error);}
      return Response.json({ok:true,fields,message:'Changes sent to the Studio for review.'});
    }catch(reason){return Response.json({error:reason instanceof Error?reason.message:'Could not submit project changes.'},{status:400});}
  }

  if(body.action==='approve'||body.action==='decline'){
    if(!isStudioAdmin(user))return Response.json({error:'Studio admin access required.'},{status:403});
    const project=await getProjectForUser(id,user);
    if(!project)return Response.json({error:'Project not found.'},{status:404});
    const note=clean(body.note,800);
    try{
      const fields=await reviewProjectEssentialsChange(id,user,body.action,note);
      try{await sendProjectWorkflowEmail({to:project.owner_email,subject:`Project changes ${body.action==='approve'?'accepted':'declined'}: ${project.title}`,heading:body.action==='approve'?'Your project changes were accepted.':'Your project changes were not accepted.',message:`Studio reviewed changes to: ${fields.join(', ')}.${note?`\n\nStudio note: ${note}`:''}`,projectId:id});}catch(error){console.error('Client change review email failed',error);}
      return Response.json({ok:true,fields,message:body.action==='approve'?'Client changes accepted.':'Client changes declined.'});
    }catch(reason){return Response.json({error:reason instanceof Error?reason.message:'Could not review project changes.'},{status:400});}
  }
  return Response.json({error:'Choose a valid project change action.'},{status:400});
}
