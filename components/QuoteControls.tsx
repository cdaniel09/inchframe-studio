'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProjectQuote,QuoteOffer } from '@/lib/data';

function money(cents:number){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);}
function roleLabel(value:string){return value==='creator'?'Creator':'Customer';}

type QuoteView={quote:ProjectQuote;offers:QuoteOffer[];creator:{id:string;display_name:string;headline:string;rate_min:number}};
export function QuoteControls({projectId,bundle,viewer,platformMinimum,feeBps}:{projectId:string;bundle:QuoteView;viewer:'client'|'creator'|'admin';platformMinimum:number;feeBps:number}){
  const router=useRouter();
  const[busy,setBusy]=useState('');
  const[message,setMessage]=useState('');
  const quote=bundle.quote;
  const minimum=Math.max(platformMinimum,bundle.creator.rate_min*100);
  const amount=quote.amount_cents;
  const inchframe=Math.round(amount*feeBps/10000);
  const processing=amount?Math.round(amount*.029)+30:0;
  const creatorEstimate=Math.max(0,amount-inchframe-processing);

  async function act(action:string,payload:Record<string,unknown>={}){
    if(action==='decline'&&!window.confirm('Close this quote?'))return;
    setBusy(action);setMessage('');
    try{
      const response=await fetch(`/api/projects/${projectId}/quote`,{method:'POST',credentials:'include',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({action,...payload})});
      const result=await response.json() as {message?:string;error?:string};
      if(!response.ok)throw new Error(result.error||'Could not update the quote.');
      setMessage(result.message||'Updated.');router.refresh();
    }catch(reason){setMessage(reason instanceof Error?reason.message:'Could not update the quote.');}
    finally{setBusy('');}
  }

  async function submitOffer(event:React.FormEvent<HTMLFormElement>,action:'offer'|'counter'){
    event.preventDefault();const form=new FormData(event.currentTarget);
    await act(action,{amount:form.get('amount'),note:form.get('note')});
  }

  async function checkout(){
    setBusy('checkout');setMessage('');
    try{
      const response=await fetch(`/api/projects/${projectId}/checkout`,{method:'POST',credentials:'include',cache:'no-store'});
      const result=await response.json() as {url?:string;error?:string};
      if(!response.ok||!result.url)throw new Error(result.error||'Could not start payment.');
      window.location.assign(result.url);
    }catch(reason){setMessage(reason instanceof Error?reason.message:'Could not start payment.');setBusy('');}
  }

  return <div className="quote-workflow">
    <div className="quote-creator">
      <img src={`/api/creator-icons/${bundle.creator.id}`} alt=""/>
      <div><span className="card-code">PRIVATE CREATOR QUOTE</span><strong>{bundle.creator.display_name}</strong><p>{bundle.creator.headline}</p></div>
    </div>

    {amount>0&&<div className="quote-numbers">
      <div><span>Customer price</span><strong>{money(amount)}</strong></div>
      <div><span>Required now</span><strong>{money(quote.deposit_cents)}</strong></div>
      {(viewer==='creator'||viewer==='admin')&&<><div><span>Inchframe · {feeBps/100}%</span><strong>− {money(inchframe)}</strong></div><div><span>Estimated creator payout</span><strong>{money(creatorEstimate)}</strong><small>Before Connect/payout fees; actual Stripe fees control.</small></div></>}
    </div>}

    {quote.status==='awaiting_creator'&&viewer==='creator'&&<form className="quote-form" onSubmit={event=>submitOffer(event,'offer')}>
      <div><strong>{quote.latest_actor==='client'?'Respond to the counteroffer':'Send the customer-facing quote'}</strong><p>Minimum {money(minimum)}. The displayed total includes Inchframe’s 20%; processing and payout fees are deducted from creator compensation.</p></div>
      <label><span>Total project price · USD</span><input name="amount" type="number" min={minimum/100} max="1000000" step="1" required defaultValue={amount?amount/100:minimum/100}/></label>
      <label><span>Scope note</span><textarea name="note" rows={4} maxLength={1000} required placeholder="Deliverables, turnaround, included revisions, and exclusions." defaultValue=""/></label>
      <div className="review-actions"><button className="mini-button approve" disabled={Boolean(busy)} type="submit">{busy==='offer'?'Sending…':'Send quote →'}</button><button className="mini-button warn" disabled={Boolean(busy)} type="button" onClick={()=>act('decline')}>Decline request</button></div>
    </form>}

    {quote.status==='awaiting_creator'&&viewer!=='creator'&&<div className="stage-message"><strong>{quote.latest_actor==='client'?'Counteroffer sent.':'Waiting for Studio Partner quote.'}</strong><p>{quote.latest_actor==='client'?'The Studio Partner can accept the amount by returning it as the next formal quote, revise it, or decline.':'The selected Studio Partner has private access to the essential brief.'}</p></div>}

    {quote.status==='awaiting_customer'&&viewer==='client'&&<div className="quote-decision">
      <div className="stage-message good"><strong>Quote ready.</strong><p>{quote.latest_note||'Review the total, deposit, and creator before continuing.'} The quote expires {quote.expires_at?new Date(quote.expires_at).toLocaleDateString():'in seven days'}.</p></div>
      <div className="review-actions"><button className="mini-button approve" disabled={Boolean(busy)} onClick={()=>act('accept')}>{busy==='accept'?'Accepting…':'Accept quote'}</button><button className="mini-button warn" disabled={Boolean(busy)} onClick={()=>act('decline')}>Decline</button></div>
      {quote.counter_count<2&&<details className="counter-panel"><summary>Make a counteroffer</summary><form className="quote-form" onSubmit={event=>submitOffer(event,'counter')}><label><span>Counter total · minimum {money(minimum)}</span><input name="amount" type="number" min={minimum/100} max="1000000" step="1" required defaultValue={amount/100}/></label><label><span>What should change?</span><textarea name="note" rows={3} maxLength={1000} required/></label><button className="mini-button" disabled={Boolean(busy)} type="submit">{busy==='counter'?'Sending…':`Send counter · ${2-quote.counter_count} left`}</button></form></details>}
    </div>}

    {quote.status==='awaiting_customer'&&viewer!=='client'&&<div className="stage-message"><strong>Quote with customer.</strong><p>The customer can accept, decline, or use one of two structured counteroffers.</p></div>}
    {quote.status==='admin_review'&&viewer==='admin'&&<div className="stage-message warn"><strong>Automatic exception check.</strong><p>This quote crossed the high-value threshold or requests delivery in under seven days. Admin approves the exception—not the price.</p><button className="mini-button approve" disabled={Boolean(busy)} onClick={()=>act('approve')}>{busy==='approve'?'Releasing…':'Clear exception + release quote'}</button></div>}
    {quote.status==='admin_review'&&viewer!=='admin'&&<div className="stage-message"><strong>Brief exception check.</strong><p>The Studio is checking timing or transaction guardrails before releasing the quote. No admin price-setting is involved.</p></div>}

    {quote.status==='accepted'&&!quote.deposit_paid_at&&viewer==='client'&&<div className="stage-message good"><strong>Quote accepted. Lock the assignment.</strong><p>Pay {money(quote.deposit_cents)} now. The advanced media workspace opens automatically after Stripe confirms payment.</p><button className="button button-green" disabled={Boolean(busy)} onClick={checkout}>{busy==='checkout'?'Opening Stripe…':`Pay ${money(quote.deposit_cents)} securely →`}</button></div>}
    {quote.status==='accepted'&&!quote.deposit_paid_at&&viewer!=='client'&&<div className="stage-message good"><strong>Assignment accepted.</strong><p>The Studio Partner is reserved while the customer completes the required payment.</p></div>}
    {quote.status==='accepted'&&quote.deposit_paid_at&&<div className="stage-message good"><strong>Assignment funded.</strong><p>The advanced project workspace is open and production communication remains inside Studio.</p></div>}
    {quote.status==='declined'&&<div className="stage-message warn"><strong>Quote closed.</strong><p>The current Studio Partner assignment is no longer active. Inchframe can route the brief to another Studio Partner.</p></div>}

    {bundle.offers.length>0&&<details className="offer-history"><summary>Offer history · {bundle.offers.length}</summary>{bundle.offers.map(offer=><div key={offer.id}><span>{roleLabel(offer.actor_role)}</span><strong>{money(offer.amount_cents)}</strong><p>{offer.note}</p><small>{new Date(offer.created_at).toLocaleString()}</small></div>)}</details>}
    {message&&<p className="control-message" role="status">{message}</p>}
  </div>;
}
