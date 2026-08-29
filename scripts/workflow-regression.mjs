import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdir,rm} from 'node:fs/promises';
import path from 'node:path';

const studioPort=4310,mockPort=4311,base=`http://127.0.0.1:${studioPort}`;
const repo=process.cwd(),temp=path.resolve(repo,'.tmp-workflow-regression');
if(path.dirname(temp)!==repo||path.basename(temp)!=='.tmp-workflow-regression')throw new Error('Unsafe temporary test path.');

function identity(code){
  if(code==='chris')return{user:{id:'account-test-chris',email:'chris@inchframe.com',email_verified:true,display_name:'Chris'},roles:[],entitlements:{tier:'creator',subscription_status:'none',studio_partner_eligible:false}};
  if(code==='support')return{user:{id:'account-test-support',email:'support@inchframe.com',email_verified:true,display_name:'Inchframe Support Partner'},roles:[],entitlements:{tier:'pro',subscription_status:'active',studio_partner_eligible:true}};
  if(code==='admin')return{user:{id:'account-test-admin',email:'admin@inchframe.com',email_verified:true,display_name:'Studio Admin'},roles:['studio_admin'],entitlements:{tier:'pro',subscription_status:'active',studio_partner_eligible:true}};
  return null;
}

const mock=createServer((request,response)=>{
  if(request.method!=='POST'||request.url!=='/api/sso/token'){response.writeHead(404).end();return;}
  let raw='';request.setEncoding('utf8');request.on('data',chunk=>raw+=chunk);request.on('end',()=>{
    const payload=identity(new URLSearchParams(raw).get('code'));
    response.setHeader('content-type','application/json');
    if(!payload){response.writeHead(400).end(JSON.stringify({error:'invalid_grant'}));return;}
    response.end(JSON.stringify(payload));
  });
});

function listen(server,port){return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});}
function close(server){return new Promise(resolve=>server.close(()=>resolve()));}
async function waitForStudio(child,getLog){
  for(let attempt=0;attempt<80;attempt++){
    if(child.exitCode!==null)throw new Error(`Studio exited early (${child.exitCode}).\n${getLog()}`);
    try{const response=await fetch(`${base}/login`,{signal:AbortSignal.timeout(1000)});if(response.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error(`Studio did not become ready.\n${getLog()}`);
}
function cookieFrom(response){
  const values=typeof response.headers.getSetCookie==='function'?response.headers.getSetCookie():[response.headers.get('set-cookie')||''];
  const signed=values.find(value=>value.startsWith('inchframe_studio_auth_v3='));
  if(!signed)throw new Error('SSO callback did not set a signed Studio session.');
  return signed.split(';',1)[0];
}
async function signIn(code,returnTo,intent='customer'){
  const start=await fetch(`${base}/api/auth/account/start?returnTo=${encodeURIComponent(returnTo)}&intent=${intent}`,{redirect:'manual'});
  if(start.status!==303)throw new Error(`SSO start failed for ${code}: ${start.status}`);
  const authorize=new URL(start.headers.get('location'));
  const state=authorize.searchParams.get('state');
  if(!state)throw new Error(`SSO start omitted state for ${code}.`);
  const callback=await fetch(`${base}/api/auth/account/callback?code=${code}&state=${encodeURIComponent(state)}`,{redirect:'manual'});
  if(callback.status!==303)throw new Error(`SSO callback failed for ${code}: ${callback.status}`);
  return cookieFrom(callback);
}
async function request(pathname,{cookie,method='GET',json,form}={}){
  const headers={};if(cookie)headers.cookie=cookie;if(json)headers['content-type']='application/json';
  const response=await fetch(`${base}${pathname}`,{method,headers,body:json?JSON.stringify(json):form,redirect:'manual'});
  const text=await response.text();return{response,text};
}
function assert(condition,message){if(!condition)throw new Error(message);}

await rm(temp,{recursive:true,force:true});await mkdir(path.join(temp,'uploads'),{recursive:true});
await listen(mock,mockPort);
let output='';
const nextBin=path.join(repo,'node_modules','next','dist','bin','next');
const child=spawn(process.execPath,[nextBin,'start','-p',String(studioPort)],{cwd:repo,env:{...process.env,NODE_ENV:'production',DATABASE_PATH:path.join(temp,'studio.sqlite'),UPLOAD_DIR:path.join(temp,'uploads'),AUTH_SECRET:'workflow-regression-secret-at-least-32-characters',ADMIN_EMAIL:'admin@inchframe.com',INQUIRY_NOTIFICATION_EMAIL:'admin@inchframe.com',STUDIO_AUTH_MODE:'account',ACCOUNT_SSO_BASE_URL:`http://127.0.0.1:${mockPort}`,STUDIO_SSO_CLIENT_ID:'workflow-client',STUDIO_SSO_CLIENT_SECRET:'workflow-secret',STUDIO_SSO_REDIRECT_URI:`${base}/api/auth/account/callback`,NEXT_PUBLIC_SITE_URL:base}});
child.stdout.on('data',chunk=>output=(output+chunk.toString()).slice(-30000));child.stderr.on('data',chunk=>output=(output+chunk.toString()).slice(-30000));

try{
  await waitForStudio(child,()=>output);
  const chris=await signIn('chris','/portal/projects/test-project-chris');
  let result=await request('/portal/projects/test-project-chris',{cookie:chris});
  assert(result.response.status===200&&result.text.includes('Edit project request'),'Chris can open an editable project request.');
  result=await request('/api/projects/test-project-chris/changes',{cookie:chris,method:'POST',json:{action:'submit',title:'Studio workflow test request — revised',projectType:'brand_film',brief:'Test the editable client project request, admin acceptance, and retained project history.',audience:'Inchframe customers and Studio clients',platforms:'Web, social, and launch page',dueDate:'2026-10-22',budgetRange:'2500_5000'}});
  assert(result.response.status===200,`Chris change request failed: ${result.response.status} ${result.text}`);
  result=await request('/portal/projects/test-project-chris',{cookie:chris});
  assert(result.text.includes('Changes waiting for Studio review'),'Chris sees the pending-change state.');

  const admin=await signIn('admin','/portal/projects/test-project-chris');
  result=await request('/portal/projects/test-project-chris',{cookie:admin});
  assert(result.response.status===200&&result.text.includes('Client changes need acceptance'),'Admin sees the client acceptance review.');
  result=await request('/api/projects/test-project-chris/changes',{cookie:admin,method:'POST',json:{action:'approve',note:'Approved by the workflow regression.'}});
  assert(result.response.status===200,`Admin acceptance failed: ${result.response.status} ${result.text}`);
  result=await request('/portal/projects/test-project-chris',{cookie:chris});
  assert(result.response.status===200&&result.text.includes('Studio workflow test request — revised')&&!result.text.includes('Changes waiting for Studio review'),'Accepted client values became the live project.');

  const support=await signIn('support','/studio-partners/apply','studio_partner');
  result=await request('/studio-partners/apply',{cookie:support});
  assert(result.response.status===200&&result.text.includes('Update application'),'Support can open an editable Partner application.');
  const form=new FormData();
  for(const[key,value]of Object.entries({displayName:'Inchframe Support Partner',location:'Remote · Pacific',headline:'Production support for directed AI video workflows',bio:'Test Partner profile for reviewing editable rates, availability, work links, and Studio change notices.',specialties:'Production support, workflow review, AI video',availability:'Available for two test assignments per month',rateUnit:'project',rateMin:'650',rateMax:'1750',inchframeEmail:'support@inchframe.com',sampleTitle1:'Inchframe workflow example',sampleUrl1:'https://inchframe.com',proConfirmed:'yes',contractorConfirmed:'yes',contactConfirmed:'yes',verificationConfirmed:'yes'}))form.set(key,value);
  result=await request('/api/creators',{cookie:support,method:'POST',form});
  assert(result.response.status===201,`Support Partner update failed: ${result.response.status} ${result.text}`);
  result=await request('/portal/studio-partners',{cookie:admin});
  assert(result.response.status===200&&result.text.includes('Partner changed values')&&result.text.includes('Minimum rate')&&result.text.includes('Availability')&&result.text.includes('Work samples'),'Admin sees the Partner changed-value notice.');
  console.log('PASS Chris client request is editable and change-controlled.');
  console.log('PASS Admin can inspect and accept client changes.');
  console.log('PASS Support Partner profile is editable without a legacy key.');
  console.log('PASS Admin sees the Partner changed-field notice.');
}catch(error){console.error(error instanceof Error?error.stack:error);console.error('\nStudio output:\n'+output);process.exitCode=1;}
finally{
  child.kill();await new Promise(resolve=>{if(child.exitCode!==null)resolve();else{child.once('exit',resolve);setTimeout(resolve,2000);}});
  await close(mock);await rm(temp,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
