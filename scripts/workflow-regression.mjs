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
  if(code==='manager')return{user:{id:'account-test-manager',email:'cdaniel09@gmail.com',email_verified:true,display_name:'Chris Daniel'},roles:['studio_admin'],entitlements:{tier:'pro',subscription_status:'active',studio_partner_eligible:true}};
  return null;
}

const grants=new Map();
const mock=createServer((request,response)=>{
  if(request.method!=='POST'||!['/api/sso/token','/api/sso/session'].includes(request.url)){response.writeHead(404).end();return;}
  let raw='';request.setEncoding('utf8');request.on('data',chunk=>raw+=chunk);request.on('end',()=>{
    const body=new URLSearchParams(raw);
    if(request.url==='/api/sso/session'){
      const account=grants.get(body.get('session_token'));
      response.setHeader('content-type','application/json');
      response.end(JSON.stringify(account?{active:true,account_id:account.user.id,roles:account.roles}:{active:false}));return;
    }
    const payload=identity(body.get('code'));
    response.setHeader('content-type','application/json');
    if(!payload){response.writeHead(400).end(JSON.stringify({error:'invalid_grant'}));return;}
    const session_token=Buffer.from(body.get('code').padEnd(32,'_')).toString('base64url');
    grants.set(session_token,payload);
    response.end(JSON.stringify({...payload,session_token,session_expires_at:new Date(Date.now()+3600000).toISOString()}));
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
  const binding=start.headers.getSetCookie().find(value=>value.startsWith('inchframe_studio_sso_state='))?.split(';',1)[0];
  if(!binding)throw new Error('SSO start omitted browser binding.');
  const callback=await fetch(`${base}/api/auth/account/callback?code=${code}&state=${encodeURIComponent(state)}`,{redirect:'manual',headers:{cookie:binding}});
  if(callback.status!==303)throw new Error(`SSO callback failed for ${code}: ${callback.status}`);
  return cookieFrom(callback);
}
async function localSignIn(email,password,returnTo){
  const form=new FormData();form.set('email',email);form.set('password',password);form.set('returnTo',returnTo);
  const response=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{accept:'application/json','x-requested-with':'InchframeStudio'},body:form,redirect:'manual'});
  if(response.status!==200)throw new Error(`Native Studio login failed: ${response.status} ${await response.text()}`);
  return cookieFrom(response);
}
async function request(pathname,{cookie,method='GET',json,form,headers:additionalHeaders={}}={}){
  const headers={...additionalHeaders};if(cookie)headers.cookie=cookie;if(json)headers['content-type']='application/json';
  const response=await fetch(`${base}${pathname}`,{method,headers,body:json?JSON.stringify(json):form,redirect:'manual'});
  const text=await response.text();return{response,text};
}
function assert(condition,message){if(!condition)throw new Error(message);}

await rm(temp,{recursive:true,force:true});await mkdir(path.join(temp,'uploads'),{recursive:true});
await listen(mock,mockPort);
let output='';
const nextBin=path.join(repo,'node_modules','next','dist','bin','next');
const child=spawn(process.execPath,[nextBin,'start','-p',String(studioPort)],{cwd:repo,env:{...process.env,NODE_ENV:'production',DATABASE_PATH:path.join(temp,'studio.sqlite'),UPLOAD_DIR:path.join(temp,'uploads'),AUTH_SECRET:'workflow-regression-secret-at-least-32-characters',ADMIN_EMAIL:'admin@inchframe.com',ADMIN_PASSWORD_HASH:'scrypt$workflow-native-login$D5BDbgJcG_8dCShLhkifddlS4ER4_a-ZM_IdKcRGrPD1nPVL0nTNUpNM-hrWaWFwEfjHRUtvdVAz5Ch-YHKbbw',INQUIRY_NOTIFICATION_EMAIL:'admin@inchframe.com',STUDIO_AUTH_MODE:'hybrid',ACCOUNT_SSO_BASE_URL:`http://127.0.0.1:${mockPort}`,STUDIO_SSO_CLIENT_ID:'workflow-client',STUDIO_SSO_CLIENT_SECRET:'workflow-secret',STUDIO_SSO_REDIRECT_URI:`${base}/api/auth/account/callback`,NEXT_PUBLIC_SITE_URL:base}});
child.stdout.on('data',chunk=>output=(output+chunk.toString()).slice(-30000));child.stderr.on('data',chunk=>output=(output+chunk.toString()).slice(-30000));

try{
  await waitForStudio(child,()=>output);
  let result=await request('/login');
  assert(result.response.status===200&&result.text.includes('SIGN IN TO STUDIO')&&result.text.indexOf('SIGN IN TO STUDIO')<result.text.indexOf('INCHFRAME ACCOUNT')&&result.text.includes('Create a client account')&&!result.text.includes('Your session changed during the Studio deployment'),'Studio email/password is the default sign-in without deployment-specific session copy.');
  result=await request('/');
  assert(result.response.status===200&&result.text.includes('Studio is coming soon')&&result.text.includes('href="/register"')&&result.text.includes('href="/studio-partners"')&&result.text.includes('inchframe-watermark-bug.png'),'Public Studio pages show the pre-launch notice while keeping early project inquiry and Partner information routes available.');
  result=await request('/studio-partners');
  assert(result.response.status===200&&result.text.includes('Find your production')&&result.text.includes('For clients')&&result.text.includes('For future Partner candidates')&&result.text.includes('PLANNED REQUIREMENTS')&&result.text.includes('Partner applications opening later'),'Studio Partner page serves clients and clearly pauses new external Partner applications.');
  assert(!result.text.includes('/api/auth/account/start?returnTo=%2Fportal%2Fstudio-partners&amp;intent=studio_partner'),'Closed Partner recruitment does not send public visitors into Account SSO.');
  result=await request('/studio-partners/apply');
  assert(result.response.status===200&&result.text.includes('Partner applications')&&result.text.includes('are opening later'),'The direct Partner application route presents the pre-launch pause without requiring sign-in.');
  result=await request('/register');
  assert(result.response.status===200&&result.text.includes('CREATE CLIENT ACCESS')&&result.text.includes('Create account'),'Native Studio client signup is available.');
  const invalidSignup=new FormData();invalidSignup.set('displayName','Test Client');invalidSignup.set('email','client@example.com');invalidSignup.set('password','short');
  result=await request('/api/auth/register',{method:'POST',form:invalidSignup,headers:{accept:'application/json','x-requested-with':'InchframeStudio'}});
  assert(result.response.status===400&&result.text.includes('at least 10 characters'),'Native Studio registration API accepts the signup flow and validates input.');
  const nativeAdmin=await localSignIn('admin@inchframe.com','Workflow-password-123!','/portal');
  result=await request('/portal',{cookie:nativeAdmin});
  assert(result.response.status===200&&result.text.includes('Studio production desk'),'Email/password login creates a durable authenticated Studio session.');
  const chris=await signIn('chris','/portal/projects/test-project-chris');
  result=await request('/api/creators',{cookie:chris,method:'POST',form:new FormData()});
  assert(result.response.status===403&&result.text.includes('applications are paused'),'The API blocks a new external Partner application while recruitment is closed.');
  result=await request('/portal/projects/test-project-chris',{cookie:chris});
  assert(result.response.status===200&&result.text.includes('Edit project request'),'Chris can open an editable project request.');
  result=await request('/api/projects/test-project-chris/changes',{cookie:chris,method:'POST',json:{action:'submit',title:'Studio workflow test request — revised',projectType:'brand_film',brief:'Test the editable client project request, admin acceptance, and retained project history.',audience:'Inchframe customers and Studio clients',platforms:'Web, social, and launch page',dueDate:'2026-10-22',budgetRange:'2500_5000'}});
  assert(result.response.status===200,`Chris change request failed: ${result.response.status} ${result.text}`);
  result=await request('/portal/projects/test-project-chris',{cookie:chris});
  assert(result.text.includes('Changes waiting for Studio review'),'Chris sees the pending-change state.');

  const admin=await signIn('admin','/portal/projects/test-project-chris');
  let partnerDesk=await request('/portal/studio-partners',{cookie:admin});
  assert(partnerDesk.response.status===200&&partnerDesk.text.includes('Approved and active')&&!partnerDesk.text.includes('Approve internal profile'),'Approved internal profile shows an active state instead of a disabled approval button.');
  result=await request('/portal/projects/test-project-chris',{cookie:admin});
  assert(result.response.status===200&&result.text.includes('Client changes need acceptance'),'Admin sees the client acceptance review.');
  result=await request('/api/projects/test-project-chris/changes',{cookie:admin,method:'POST',json:{action:'approve',note:'Approved by the workflow regression.'}});
  assert(result.response.status===200,`Admin acceptance failed: ${result.response.status} ${result.text}`);
  result=await request('/portal/projects/test-project-chris',{cookie:chris});
  assert(result.response.status===200&&result.text.includes('Studio workflow test request — revised')&&!result.text.includes('Changes waiting for Studio review'),'Accepted client values became the live project.');

  const support=await signIn('support','/studio-partners/apply','studio_partner');
  result=await request('/portal/studio-partners',{cookie:support});
  assert(result.response.status===200&&result.text.includes('Internal Partner active')&&result.text.includes('Project requests + assignments'),'Support starts as an active internal Partner.');
  result=await request('/studio-partners',{cookie:support});
  assert(result.response.status===200&&result.text.includes('Inchframe Support Partner')&&result.text.includes('Open your Partner dashboard'),'Approved internal Support Partner remains visible and can enter its dashboard while recruitment is closed.');
  result=await request('/studio-partners/inchframe-support-partner');
  assert(result.response.status===200&&result.text.includes('Request this Studio Partner'),'Support has a public Partner profile and request path.');
  result=await request('/portal/projects/test-project-chris',{cookie:admin});
  assert(result.response.status===200&&result.text.includes('Inchframe Support Partner'),'Admin can select Support for the normal Partner workflow.');
  result=await request('/studio-partners/apply',{cookie:support});
  assert(result.response.status===200&&result.text.includes('Update application'),'Support can open an editable Partner application.');
  const form=new FormData();
  for(const[key,value]of Object.entries({displayName:'Inchframe Support Partner',location:'Remote · Pacific',headline:'Production support for directed AI video workflows',bio:'Test Partner profile for reviewing editable rates, availability, work links, and Studio change notices.',specialties:'Production support, workflow review, AI video',availability:'Available for two test assignments per month',rateUnit:'project',rateMin:'650',rateMax:'1750',inchframeEmail:'support@inchframe.com',sampleTitle1:'Inchframe workflow example',sampleUrl1:'https://inchframe.com',proConfirmed:'yes',contractorConfirmed:'yes',contactConfirmed:'yes',verificationConfirmed:'yes'}))form.set(key,value);
  result=await request('/api/creators',{cookie:support,method:'POST',form});
  assert(result.response.status===201,`Support Partner update failed: ${result.response.status} ${result.text}`);
  result=await request('/portal/studio-partners',{cookie:admin});
  assert(result.response.status===200&&result.text.includes('Partner changed values')&&result.text.includes('Minimum rate')&&result.text.includes('Availability')&&result.text.includes('Work samples'),'Admin sees the Partner changed-value notice.');
  result=await request('/api/creators/test-profile-support/review',{cookie:admin,method:'POST',json:{action:'approve',proVerified:false,identityVerified:false,taxVerified:false}});
  assert(result.response.status===200,`Internal Partner reapproval failed: ${result.response.status} ${result.text}`);
  result=await request('/portal/studio-partners',{cookie:support});
  assert(result.response.status===200&&result.text.includes('Internal Partner active'),'Support returns to active Partner status after admin review.');

  const manager=await signIn('manager','/portal/studio-partners');
  result=await request('/portal/studio-partners',{cookie:manager});
  assert(result.response.status===200&&result.text.includes('Edit shared profile')&&result.text.includes('Inchframe Support Partner'),'Shared admin can open the Support Partner profile from the Partner desk.');
  result=await request('/studio-partners/apply',{cookie:manager});
  assert(result.response.status===200&&result.text.includes('Update application'),'Shared admin can open the editable Support Partner application.');
  const managerForm=new FormData();
  for(const[key,value]of Object.entries({displayName:'Inchframe Support Partner',location:'Remote · Pacific',headline:'Production support for directed AI video workflows',bio:'Test Partner profile for reviewing editable rates, availability, work links, and Studio change notices.',specialties:'Production support, workflow review, AI video',availability:'Shared management test availability',rateUnit:'project',rateMin:'650',rateMax:'1750',inchframeEmail:'support@inchframe.com',sampleTitle1:'Inchframe workflow example',sampleUrl1:'https://inchframe.com'}))managerForm.set(key,value);
  result=await request('/api/creators',{cookie:manager,method:'POST',form:managerForm});
  assert(result.response.status===201,`Shared Support Partner update failed: ${result.response.status} ${result.text}`);
  result=await request('/portal/studio-partners',{cookie:manager});
  assert(result.response.status===200&&result.text.includes('Partner changed values')&&result.text.includes('Availability'),'Shared admin sees the review notice generated by the profile edit.');
  result=await request('/api/creators/test-profile-support/review',{cookie:manager,method:'POST',json:{action:'approve',proVerified:false,identityVerified:false,taxVerified:false}});
  assert(result.response.status===200,`Shared Partner review failed: ${result.response.status} ${result.text}`);
  result=await request('/portal/studio-partners',{cookie:support});
  assert(result.response.status===200&&result.text.includes('Internal Partner active'),'Support retains the active Partner workflow after shared-admin review.');
  console.log('PASS Chris client request is editable and change-controlled.');
  console.log('PASS Admin can inspect and accept client changes.');
  console.log('PASS Support Partner profile is editable without a legacy key.');
  console.log('PASS Admin sees the Partner changed-field notice.');
  console.log('PASS Support is assignable and displayed in the public Studio Partner directory.');
  console.log('PASS Approved internal profile has an unambiguous active admin state.');
  console.log('PASS cdaniel09@gmail.com can manage the shared Support profile while retaining admin review.');
  console.log('PASS Studio client signup is restored and email/password is the default sign-in.');
  console.log('PASS Public project and Studio Partner entry points use the requested destinations.');
}catch(error){console.error(error instanceof Error?error.stack:error);console.error('\nStudio output:\n'+output);process.exitCode=1;}
finally{
  child.kill();await new Promise(resolve=>{if(child.exitCode!==null)resolve();else{child.once('exit',resolve);setTimeout(resolve,2000);}});
  await close(mock);await rm(temp,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
