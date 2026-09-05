import 'server-only';
import type Stripe from 'stripe';
import {markProjectDepositPaid} from '@/lib/data';

export async function fulfillProjectCheckout(session:Stripe.Checkout.Session){
  if(session.payment_status!=='paid')return;
  if(session.mode!=='payment'||session.status!=='complete')throw new Error('Unexpected checkout payment mode or status.');
  const metadata=session.metadata||{};
  const paymentIntentId=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id||null;
  await markProjectDepositPaid({
    attemptId:metadata.checkout_attempt_id||'',projectId:metadata.project_id||'',quoteId:metadata.quote_id||'',
    quoteVersion:metadata.quote_version||'',checkoutSessionId:session.id,paymentIntentId,
    amountTotal:session.amount_total,currency:session.currency,
  });
}
