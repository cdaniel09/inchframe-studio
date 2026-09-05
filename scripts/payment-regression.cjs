// Real Studio modules and SQLite; synthetic identities, browser cookies and Account exchange.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');
const projectRequire=createRequire(path.join(root,'package.json'));
const ts=projectRequire('typescript');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'inchframe-payment-regression-'));
process.env.DATABASE_PATH=path.join(temp,'studio.sqlite');
process.env.AUTH_SECRET='isolated-auth-regression-only-no-production-secret';
process.env.ADMIN_EMAIL='admin@example.invalid';
process.env.STUDIO_ADMIN_EMAILS='';
process.env.STUDIO_AUTH_MODE='hybrid';
process.env.STUDIO_SSO_CLIENT_ID='test-client';
process.env.STUDIO_SSO_CLIENT_SECRET='test-secret';
process.env.STUDIO_SSO_REDIRECT_URI='https://studio.example/api/auth/account/callback';
process.env.NEXT_PUBLIC_SITE_URL='https://studio.example';
const jar=new Map();
const cookieStore={
 get:name=>jar.has(name)?{name,value:jar.get(name)}:undefined,
 getAll:name=>jar.has(name)?[{name,value:jar.get(name)}]:[],
 set:(name,value,opts)=>opts.maxAge===0?jar.delete(name):jar.set(name,value),
};
const stripeMock={checkout:{sessions:{}}};
const cache=new Map();
function load(relative){
 const filename=path.join(root,relative);
 if(cache.has(filename))return cache.get(filename).exports;
 const module={exports:{}};cache.set(filename,module);
 const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 function localRequire(name){
  if(name==='server-only')return {};
  if(name==='@/lib/stripe')return {stripe:()=>stripeMock};
  if(name==='next/headers')return {cookies:async()=>cookieStore};
  if(name==='next/navigation')return {redirect:value=>{throw new Error(value);}};
  if(name.startsWith('@/'))return load(name.slice(2)+'.ts');
  return projectRequire(name);
 }
 new Function('require','module','exports',compiled)(localRequire,module,module.exports);
 return module.exports;
}
async function main(){
 const data=load('lib/data.ts'),auth=load('app/chatgpt-auth.ts'),payment=load('lib/project-payment.ts');
 const user=await data.upsertAccountSsoUser({id:'payer',email:'payer@example.invalid',emailVerified:true,displayName:'Payer',roles:[],tier:null,subscriptionStatus:'none',studioPartnerEligible:false,studioPartnerInviteId:null,studioPartnerInviteExpiresAt:null});
 global.fetch=async(url)=>{assert.equal(new URL(url).pathname,'/api/sso/session');return Response.json({active:true,account_id:'payer',roles:['customer']});};
 await auth.createStudioSession(user,'p'.repeat(43));
 const db=globalThis.inchframeStudioDb;
 async function fixture(){
  const project=await data.createProject(user,{title:'Payment regression',projectType:'brand_film',brief:'Synthetic test',audience:'',platforms:'',dueDate:null,budgetRange:'500_1000'});
  const projectId=typeof project==='string'?project:project.id,quoteId=crypto.randomUUID(),now=new Date().toISOString();
  db.prepare("INSERT INTO project_quotes (id,project_id,creator_id,status,amount_cents,deposit_cents,created_at,updated_at) VALUES (?,?,?,'accepted',100000,40000,?,?)").run(quoteId,projectId,'test-profile-support',now,now);
  db.prepare("UPDATE projects SET status='deposit_required' WHERE id=?").run(projectId);
  return {projectId,quoteId};
 }
 function session(attempt,id='cs_'+attempt.id){
  return {id,mode:'payment',status:'complete',payment_status:'paid',payment_intent:'pi_'+attempt.id,
   amount_total:attempt.amount_cents,currency:attempt.currency,metadata:JSON.parse(attempt.request_json).metadata};
 }
 const one=await fixture();
 const [a,b]=await Promise.all([data.prepareProjectCheckout(one.projectId,user),data.prepareProjectCheckout(one.projectId,user)]);
 assert.equal(a.id,b.id);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM project_checkout_attempts WHERE quote_id=?').get(one.quoteId).n,1);
 await assert.rejects(()=>data.prepareProjectCheckout(one.projectId,{...user,userId:'someone-else'}),/not found/);
 await data.bindProjectCheckout(a.id,'cs_bound');
 for(const override of [{id:'cs_other'},{amount_total:1},{currency:'eur'},{metadata:{...session(a).metadata,quote_version:'999'}},{payment_intent:null}]){
  await assert.rejects(()=>payment.fulfillProjectCheckout({...session(a,'cs_bound'),...override}));
 }
 await payment.fulfillProjectCheckout({...session(a,'cs_bound'),payment_status:'unpaid'});
 assert.equal(db.prepare('SELECT deposit_paid_at FROM project_quotes WHERE id=?').get(one.quoteId).deposit_paid_at,null);
 await payment.fulfillProjectCheckout(session(a,'cs_bound'));
 db.prepare("UPDATE projects SET status='completed' WHERE id=?").run(one.projectId);
 await payment.fulfillProjectCheckout(session(a,'cs_bound'));
 assert.equal(db.prepare('SELECT status FROM projects WHERE id=?').get(one.projectId).status,'completed');
 console.log('PASS exact payment identity/amount/currency, unpaid events, one active attempt, ownership and duplicate completion.');

 const two=await fixture(),stale=await data.prepareProjectCheckout(two.projectId,user);
 await data.bindProjectCheckout(stale.id,'cs_stale');
 await assert.rejects(()=>data.declineProjectQuote(two.projectId,user),/Payment has started/);
 // Simulate an administrative/racing change, including a later acceptance at the same price.
 db.prepare("UPDATE project_quotes SET status='declined' WHERE id=?").run(two.quoteId);
 db.prepare("UPDATE project_quotes SET status='accepted' WHERE id=?").run(two.quoteId);
 await assert.rejects(()=>payment.fulfillProjectCheckout(session(stale,'cs_stale')),/changed quote/);
 await assert.rejects(()=>data.bindProjectCheckout(stale.id,'cs_stale'),/quote changed/);
 assert.equal(db.prepare('SELECT deposit_paid_at FROM project_quotes WHERE id=?').get(two.quoteId).deposit_paid_at,null);
 const fresh=await data.prepareProjectCheckout(two.projectId,user);
 assert.notEqual(fresh.id,stale.id);
 // A verified webhook may arrive before the create request stores its session response.
 await payment.fulfillProjectCheckout(session(fresh));
 await data.bindProjectCheckout(fresh.id,session(fresh).id);
 assert.equal(db.prepare('SELECT status FROM projects WHERE id=?').get(two.projectId).status,'advanced_intake');
 console.log('PASS quote revision binding, stale-session rejection, in-flight quote lock and webhook-before-response race.');

 const api=load('app/api/projects/[id]/checkout/route.ts');
 const three=await fixture(),saved=new Map(),keys=[],payloads=[];
 let failAfterCreation=true,retrieveFails=false;
 stripeMock.checkout.sessions.create=async(params,options)=>{
  keys.push(options.idempotencyKey);payloads.push(JSON.stringify(params));
  if(!saved.has(options.idempotencyKey))saved.set(options.idempotencyKey,{
   id:'cs_'+saved.size,mode:'payment',status:'open',payment_status:'unpaid',url:'https://checkout.stripe.com/test',
   amount_total:params.line_items[0].price_data.unit_amount,currency:'usd',metadata:params.metadata
  });
  if(failAfterCreation){failAfterCreation=false;throw new Error('Simulated response lost after Stripe creation');}
  return saved.get(options.idempotencyKey);
 };
 stripeMock.checkout.sessions.retrieve=async id=>{
  if(retrieveFails)throw new Error('Simulated unavailable Stripe');
  return [...saved.values()].find(item=>item.id===id);
 };
 const post=()=>api.POST(new Request('https://studio.example/api/projects/'+three.projectId+'/checkout',{method:'POST'}),{params:Promise.resolve({id:three.projectId})});
 const oldError=console.error;console.error=()=>{};
 try{
  assert.equal((await post()).status,503);
  assert.equal((await post()).status,200);
  assert.equal(keys[0],keys[1]);assert.equal(payloads[0],payloads[1]);assert.equal(saved.size,1);
  assert.equal((await post()).status,200);assert.equal(keys.length,2);
  retrieveFails=true;
  assert.equal((await post()).status,503);assert.equal(keys.length,2);
  retrieveFails=false;
  saved.values().next().value.status='expired';
  assert.equal((await post()).status,200);assert.equal(saved.size,2);
  assert.notEqual(keys[1],keys[2]);
 }finally{console.error=oldError;}
 console.log('PASS Checkout response-loss retry reuses identical parameters/key, retrieval failure cannot create another charge, confirmed expiry allows a new attempt.');

 const four=await fixture();
 const legacy=db.prepare('UPDATE project_quotes SET stripe_checkout_session_id=? WHERE id=?').run('cs_legacy',four.quoteId);
 await assert.rejects(()=>data.prepareProjectCheckout(four.projectId,user),/Studio review/);
 console.log('PASS legacy unbound checkout is held for review.');
 console.log('Studio payment regression passed; synthetic SQLite and mocked Stripe, no network or charges.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{globalThis.inchframeStudioDb?.close();});
