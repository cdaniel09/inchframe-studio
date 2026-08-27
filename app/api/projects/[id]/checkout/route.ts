import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getProjectBundle,recordCheckoutSession } from '@/lib/data';
import { stripe } from '@/lib/stripe';

export const runtime='nodejs';
export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:'Sign in required.'},{status:401});
  const{id}=await params;
  const bundle=await getProjectBundle(id,user);
  if(!bundle||bundle.project.owner_id!==user.userId)return Response.json({error:'Project not found.'},{status:404});
  const quote=bundle.quote?.quote;
  if(!quote||quote.status!=='accepted')return Response.json({error:'Accept the Studio Partner quote before starting payment.'},{status:409});
  if(quote.deposit_paid_at)return Response.json({error:'This project payment is already complete.'},{status:409});

  try{
    const client=stripe();
    if(quote.stripe_checkout_session_id){
      try{
        const existing=await client.checkout.sessions.retrieve(quote.stripe_checkout_session_id);
        if(existing.status==='open'&&existing.url)return Response.json({url:existing.url});
      }catch(error){console.warn('Could not reuse prior Checkout session',error);}
    }
    const origin=process.env.NEXT_PUBLIC_SITE_URL?.trim()||'http://localhost:3000';
    const fullPayment=quote.deposit_cents===quote.amount_cents;
    const session=await client.checkout.sessions.create({
      mode:'payment',
      customer_email:user.email,
      billing_address_collection:'auto',
      line_items:[{quantity:1,price_data:{currency:'usd',unit_amount:quote.deposit_cents,product_data:{name:`${bundle.project.title} — ${fullPayment?'project payment':'production deposit'}`,description:`${bundle.quote?.creator.display_name} through Inchframe Studio`}}}],
      invoice_creation:{enabled:true},
      metadata:{project_id:id,quote_id:quote.id,payment_kind:fullPayment?'full':'deposit'},
      payment_intent_data:{metadata:{project_id:id,quote_id:quote.id,payment_kind:fullPayment?'full':'deposit'},transfer_group:`project_${id}`},
      success_url:new URL(`/portal/projects/${encodeURIComponent(id)}?payment=success`,origin).toString(),
      cancel_url:new URL(`/portal/projects/${encodeURIComponent(id)}?payment=cancelled`,origin).toString()
    });
    if(!session.url)return Response.json({error:'Stripe did not return a payment URL.'},{status:502});
    await recordCheckoutSession(id,user,session.id);
    return Response.json({url:session.url});
  }catch(error){
    console.error('Stripe Checkout creation failed',error);
    return Response.json({error:error instanceof Error?error.message:'Could not start Stripe Checkout.'},{status:503});
  }
}
