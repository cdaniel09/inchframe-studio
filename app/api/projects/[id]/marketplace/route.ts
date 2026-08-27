import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getCreatorApplicationById,getProjectForUser,isStudioAdmin,listProStudioProposals,routeProStudioProposal,setProStudioPublishing } from '@/lib/data';
import { sendProjectWorkflowEmail } from '@/lib/email';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const user=await getChatGPTUser();
  if(!user||!isStudioAdmin(user))return Response.json({error:'Studio admin access required.'},{status:403});
  if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Cross-site request rejected.'},{status:403});
  const{id}=await params,project=await getProjectForUser(id,user);
  if(!project)return Response.json({error:'Project not found.'},{status:404});
  let body:{action?:string;proposalId?:string};try{body=await request.json() as {action?:string;proposalId?:string};}catch{return Response.json({error:'Invalid request.'},{status:400});}
  try{
    if(body.action==='publish'||body.action==='close'){
      await setProStudioPublishing(id,user,body.action);
      return Response.json({message:body.action==='publish'?'Opportunity published for verified Studio Partners.':'Opportunity closed.'});
    }
    if(body.action==='route'){
      const proposalId=String(body.proposalId||'').slice(0,100);
      const proposals=await listProStudioProposals(id,user),proposal=proposals.find(item=>item.id===proposalId);
      if(!proposal)return Response.json({error:'Proposal not found.'},{status:404});
      await routeProStudioProposal(id,proposalId,user);
      const partner=await getCreatorApplicationById(proposal.creator_id);
      try{
        await sendProjectWorkflowEmail({to:project.owner_email,subject:`Pro Studio proposal ready: ${project.title}`,heading:'Inchframe routed a private Studio Partner proposal.',message:'Review the customer price, approach, timeframe, and included revisions in your project. You can accept or make a structured counteroffer.',projectId:id});
        if(partner)await sendProjectWorkflowEmail({to:partner.owner_email,subject:`Your proposal was routed: ${project.title}`,heading:'Inchframe routed your private proposal to the client.',message:'The client can accept or counter inside Studio. Keep all project communication in the project workspace.',projectId:id});
      }catch(error){console.error('Pro Studio routing email failed',error);}
      return Response.json({message:`Proposal routed to the client.`});
    }
    return Response.json({error:'Invalid routing action.'},{status:400});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Could not update Pro Studio routing.'},{status:400});}
}
