import type Stripe from 'stripe';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { prepareProjectCheckout,bindProjectCheckout,expireProjectCheckout } from '@/lib/data';
import { fulfillProjectCheckout } from '@/lib/project-payment';
import { stripe } from '@/lib/stripe';

export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Cross-site request rejected.'},{status:403});
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:'Sign in required.'},{status:401});
  const{id}=await params;
  try{
    const client=stripe();
    let attempt=await prepareProjectCheckout(id,user);
    if(attempt.session_id){
      // Retrieval failures are ambiguous: do not start a second payment.
      const existing=await client.checkout.sessions.retrieve(attempt.session_id);
      if(existing.status==='complete'){
        if(existing.payment_status==='paid')await fulfillProjectCheckout(existing);
        return Response.json({error:'This payment is complete or processing. Refresh the project to check its status.'},{status:409});
      }
      if(existing.status==='expired'){
        await expireProjectCheckout(attempt.id,existing.id);
        attempt=await prepareProjectCheckout(id,user);
      }else if(existing.status==='open'&&existing.url){
        await bindProjectCheckout(attempt.id,existing.id);
        return Response.json({url:existing.url},{headers:{'cache-control':'no-store'}});
      }else throw new Error('Unexpected checkout status.');
    }
    const session=await client.checkout.sessions.create(JSON.parse(attempt.request_json) as Stripe.Checkout.SessionCreateParams,
      {idempotencyKey:`studio-checkout:${attempt.id}`});
    await bindProjectCheckout(attempt.id,session.id);
    if(session.status==='complete'){
      if(session.payment_status==='paid')await fulfillProjectCheckout(session);
      return Response.json({error:'This payment is complete or processing. Refresh the project to check its status.'},{status:409});
    }
    if(session.status==='expired'){
      await expireProjectCheckout(attempt.id,session.id);
      return Response.json({error:'This checkout expired. Please try again.'},{status:409});
    }
    if(!session.url)throw new Error('Stripe did not return a payment URL.');
    return Response.json({url:session.url},{headers:{'cache-control':'no-store'}});
  }catch(error){
    console.error('Studio Checkout could not proceed',error);
    return Response.json({error:'Payment could not be started safely. Please retry, or contact Studio if a payment is already pending.'},{status:503,headers:{'cache-control':'no-store'}});
  }
}
