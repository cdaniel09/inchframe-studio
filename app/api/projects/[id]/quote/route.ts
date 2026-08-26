import { getChatGPTUser } from '@/app/chatgpt-auth';
import {
  acceptProjectQuote,approveProjectQuote,counterProjectQuote,declineProjectQuote,
  getProjectBundle,isStudioAdmin,submitCreatorQuote
} from '@/lib/data';
import { sendProjectWorkflowEmail } from '@/lib/email';

export const runtime='nodejs';
function amountCents(value:unknown){const amount=Number(value);return Number.isFinite(amount)&&amount>0&&amount<=1000000?Math.round(amount*100):0;}
function note(value:unknown){return typeof value==='string'?value.trim().slice(0,1000):'';}
async function notify(input:{to:string;subject:string;heading:string;message:string;projectId:string}){
  try{await sendProjectWorkflowEmail(input);}catch(error){console.error('Quote workflow email failed',error);}
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:'Sign in required.'},{status:401});
  if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Cross-site request rejected.'},{status:403});
  const{id}=await params;
  const before=await getProjectBundle(id,user);
  if(!before)return Response.json({error:'Project not found.'},{status:404});
  let body:{action?:string;amount?:unknown;note?:unknown};
  try{body=await request.json() as typeof body;}catch{return Response.json({error:'Invalid request.'},{status:400});}

  try{
    if(body.action==='offer'){
      const status=await submitCreatorQuote(id,user,{amountCents:amountCents(body.amount),note:note(body.note)});
      if(status==='awaiting_customer')await notify({to:before.project.owner_email,subject:`Quote ready: ${before.project.title}`,heading:'Your creator quote is ready.',message:'Review the price and deposit, then accept or make a structured counteroffer inside Studio.',projectId:id});
      return Response.json({message:status==='admin_review'?'Quote sent for an automatic Studio exception check.':'Quote sent to the customer.'});
    }
    if(body.action==='counter'){
      await counterProjectQuote(id,user,{amountCents:amountCents(body.amount),note:note(body.note)});
      if(before.quote)await notify({to:before.quote.creator.owner_email,subject:`Counteroffer: ${before.project.title}`,heading:'The customer sent a counteroffer.',message:'Review the amount and send a revised quote or decline the request inside Studio.',projectId:id});
      return Response.json({message:'Counteroffer sent.'});
    }
    if(body.action==='accept'){
      await acceptProjectQuote(id,user);
      if(before.quote)await notify({to:before.quote.creator.owner_email,subject:`Assignment accepted: ${before.project.title}`,heading:'The customer accepted your quote.',message:'The assignment is reserved while the customer completes the required project payment.',projectId:id});
      return Response.json({message:'Quote accepted. Complete the deposit to lock the assignment.'});
    }
    if(body.action==='approve'){
      if(!isStudioAdmin(user))return Response.json({error:'Studio admin access required.'},{status:403});
      await approveProjectQuote(id);
      await notify({to:before.project.owner_email,subject:`Quote ready: ${before.project.title}`,heading:'Your creator quote is ready.',message:'The Studio exception check is complete. Review the quote inside your project.',projectId:id});
      return Response.json({message:'Exception cleared and quote released to the customer.'});
    }
    if(body.action==='decline'){
      await declineProjectQuote(id,user);
      const other=user.userId===before.project.owner_id?before.quote?.creator.owner_email:before.project.owner_email;
      if(other)await notify({to:other,subject:`Quote closed: ${before.project.title}`,heading:'This quote has been closed.',message:'The current creator quote is no longer active. The project remains in Studio for next-step review.',projectId:id});
      return Response.json({message:'Quote declined.'});
    }
    return Response.json({error:'Invalid quote action.'},{status:400});
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:'Could not update the quote.'},{status:400});
  }
}
