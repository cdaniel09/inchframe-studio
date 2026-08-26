import type Stripe from 'stripe';
import { markProjectDepositPaid } from '@/lib/data';
import { stripe } from '@/lib/stripe';

export const runtime='nodejs';
async function fulfill(session:Stripe.Checkout.Session){
  if(session.payment_status!=='paid')return;
  const projectId=session.metadata?.project_id,quoteId=session.metadata?.quote_id;
  if(!projectId||!quoteId)throw new Error('Checkout session is missing project metadata.');
  const paymentIntentId=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id||null;
  await markProjectDepositPaid({projectId,quoteId,checkoutSessionId:session.id,paymentIntentId});
}

export async function POST(request:Request){
  const signature=request.headers.get('stripe-signature');
  const secret=process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if(!signature||!secret)return new Response('Stripe webhook is not configured.',{status:503});
  let event:Stripe.Event;
  try{event=stripe().webhooks.constructEvent(await request.text(),signature,secret);}
  catch(error){console.error('Stripe webhook signature failed',error);return new Response('Invalid signature.',{status:400});}
  try{
    if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded')await fulfill(event.data.object as Stripe.Checkout.Session);
    return Response.json({received:true});
  }catch(error){console.error('Stripe webhook fulfillment failed',error);return new Response('Webhook processing failed.',{status:500});}
}
