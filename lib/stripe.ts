import 'server-only';
import Stripe from 'stripe';

let stripeClient:Stripe|undefined;
export function stripe(){
  const key=process.env.STRIPE_SECRET_KEY?.trim();
  if(!key)throw new Error('Stripe payments are not configured.');
  stripeClient??=new Stripe(key);
  return stripeClient;
}
