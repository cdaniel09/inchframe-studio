import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getProjectBundle,reviewProjectAgreement,saveProjectAgreement } from '@/lib/data';
import { sendProjectWorkflowEmail } from '@/lib/email';

export const runtime='nodejs';
const text=(value:unknown,max:number)=>typeof value==='string'?value.trim().slice(0,max):'';
const date=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:null;
async function notify(to:string|undefined,input:{subject:string;heading:string;message:string;projectId:string}){if(!to)return;try{await sendProjectWorkflowEmail({to,...input});}catch(error){console.error('Agreement email failed',error);}}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in required.'},{status:401});
  if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Cross-site request rejected.'},{status:403});
  const{id}=await params,before=await getProjectBundle(id,user);if(!before)return Response.json({error:'Project not found.'},{status:404});
  let body:Record<string,unknown>;try{body=await request.json() as Record<string,unknown>;}catch{return Response.json({error:'Invalid request.'},{status:400});}
  try{
    if(body.action==='save'||body.action==='submit'){
      const status=await saveProjectAgreement(id,user,{
        goal:text(body.goal,1500),scope:text(body.scope,4000),deliverables:text(body.deliverables,4000),outOfScope:text(body.outOfScope,2500),
        startDate:date(body.startDate),targetDate:date(body.targetDate),milestones:text(body.milestones,4000),revisionRounds:Number(body.revisionRounds),
        responseExpectation:text(body.responseExpectation,500),clientResponsibilities:text(body.clientResponsibilities,2500),creatorResponsibilities:text(body.creatorResponsibilities,2500),
        finalDelivery:text(body.finalDelivery,2500),changePolicy:text(body.changePolicy,1500)
      },body.action==='submit');
      if(status==='pending_client')await notify(before.project.owner_email,{subject:`Production agreement ready: ${before.project.title}`,heading:'Your production agreement is ready.',message:'Review the goal, scope, timeframe, responsibilities, revisions, and final-delivery terms inside Studio.',projectId:id});
      return Response.json({message:status==='pending_client'?'Agreement sent to the client.':'Draft agreement saved.'});
    }
    if(body.action==='accept'||body.action==='changes'){
      const status=await reviewProjectAgreement(id,user,body.action,text(body.note,2000));
      await notify(before.quote?.creator.owner_email,{subject:`Agreement ${status==='active'?'accepted':'changes requested'}: ${before.project.title}`,heading:status==='active'?'The production agreement is active.':'The client requested agreement changes.',message:status==='active'?'The agreed scope and timeline are now locked. Use the project log for progress, decisions, and blockers.':text(body.note,2000),projectId:id});
      return Response.json({message:status==='active'?'Agreement accepted and activated.':'Change request sent to the creator.'});
    }
    return Response.json({error:'Invalid agreement action.'},{status:400});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Could not update the agreement.'},{status:400});}
}
