import { getChatGPTUser } from '@/app/chatgpt-auth';
import { checkRateLimit,saveProStudioProposal } from '@/lib/data';
import { sendProjectWorkflowEmail } from '@/lib/email';
export const runtime='nodejs';
export async function POST(request:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:'Sign in required.'},{status:401});
  if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Cross-site request rejected.'},{status:403});
  const allowed=await checkRateLimit('pro-studio-proposal',user.userId,30,60*60*1000);
  if(!allowed)return Response.json({error:'Too many proposal updates. Try again later.'},{status:429});
  let body:Record<string,unknown>;try{body=await request.json() as Record<string,unknown>;}catch{return Response.json({error:'Invalid request.'},{status:400});}
  const projectId=String(body.projectId||'').slice(0,100),action=body.action==='withdraw'?'withdraw':'submit';
  if(!projectId)return Response.json({error:'Project is required.'},{status:400});
  const amountDollars=Number(body.amountDollars),timelineDays=Number(body.timelineDays),includedRevisions=Number(body.includedRevisions);
  try{
    const saved=await saveProStudioProposal(projectId,user,{action,amountCents:Math.round(amountDollars*100),note:String(body.note||'').trim().slice(0,2000),timelineDays,includedRevisions});
    const adminEmail=process.env.INQUIRY_NOTIFICATION_EMAIL?.trim()||process.env.ADMIN_EMAIL?.trim();
    if(adminEmail)try{
      const detail=action==='withdraw'?`${saved.partnerName} withdrew a private proposal.`:`${saved.partnerName} submitted or updated a private proposal for $${amountDollars.toLocaleString('en-US')} with a ${timelineDays}-day timeframe and ${includedRevisions} included revision${includedRevisions===1?'':'s'}.`;
      await sendProjectWorkflowEmail({to:adminEmail,subject:`Pro Studio proposal activity: ${saved.title}`,heading:action==='withdraw'?'Private proposal withdrawn.':'Private proposal received.',message:detail,projectId});
    }catch(error){console.error('Pro Studio proposal notification failed',error);}
    return Response.json({message:action==='withdraw'?'Proposal withdrawn.':'Private proposal saved.'});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Could not save proposal.'},{status:400});}
}
