import type Stripe from 'stripe';
import { fulfillProjectCheckout } from '@/lib/project-payment';
import { stripe } from '@/lib/stripe';

export const runtime='nodejs';

export async function POST(request:Request){
  const signature=request.headers.get('stripe-signature');
  const secret=process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if(!signature||!secret)return new Response('Stripe webhook is not configured.',{status:503});
  let event:Stripe.Event;
  try{event=stripe().webhooks.constructEvent(await request.text(),signature,secret);}
  catch(error){console.error('Stripe webhook signature failed',error);return new Response('Invalid signature.',{status:400});}
  try{
    if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded')await fulfillProjectCheckout(event.data.object as Stripe.Checkout.Session);
    return Response.json({received:true});
  }catch(error){console.error('Stripe webhook fulfillment failed',error);return new Response('Webhook processing failed.',{status:500});}
}
