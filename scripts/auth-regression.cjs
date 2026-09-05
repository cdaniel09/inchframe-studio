// Real Studio modules and SQLite; synthetic identities, browser cookies and Account exchange.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');
const projectRequire=createRequire(path.join(root,'package.json'));
const ts=projectRequire('typescript');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'inchframe-auth-regression-'));
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
const cache=new Map();
function load(relative){
 const filename=path.join(root,relative);
 if(cache.has(filename))return cache.get(filename).exports;
 const module={exports:{}};cache.set(filename,module);
 const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 function localRequire(name){
  if(name==='server-only')return {};
  if(name==='next/headers')return {cookies:async()=>cookieStore};
  if(name==='next/navigation')return {redirect:value=>{throw new Error(value);}};
  if(name.startsWith('@/'))return load(name.slice(2)+'.ts');
  return projectRequire(name);
 }
 new Function('require','module','exports',compiled)(localRequire,module,module.exports);
 return module.exports;
}
async function main(){
 const data=load('lib/data.ts'),auth=load('app/chatgpt-auth.ts'),passwords=load('lib/password.ts'),tokens=load('lib/tokens.ts'),sso=load('lib/account-sso.ts');
 const email='owner@example.invalid',password='unverified-attacker-password';
 const grant='g'.repeat(43);
 let grantActive=true,accountUnavailable=false,reportedId='account-owner';
 global.fetch=async()=>{if(accountUnavailable)throw new Error('Simulated Account outage');return Response.json({active:grantActive,account_id:reportedId,roles:['customer']});};
 await data.createStudioAccount({email,displayName:'Unverified',passwordHash:passwords.hashPassword(password),verificationTokenHash:tokens.hashToken('stale-verification'),verificationExpiresAt:new Date(Date.now()+60000).toISOString()});
 const before=await data.findStudioAccount(email);
 const localUser={userId:before.id,email,displayName:'Unverified',fullName:'Unverified',role:'client'};
 await auth.createStudioSession(localUser);
 const oldCookie=jar.get('inchframe_studio_auth_v3');
 const identity={id:'account-owner',email,emailVerified:true,displayName:'Owner',roles:[],tier:'pro',subscriptionStatus:'active',studioPartnerEligible:true,studioPartnerInviteId:null,studioPartnerInviteExpiresAt:null};
 const user=await data.upsertAccountSsoUser(identity);
 const linked=await data.findStudioAccount(email);
 assert.equal(user.userId,before.id);
 assert.equal(linked.password_hash,'');
 assert.equal(linked.verification_token_hash,null);
 assert.equal(linked.verification_expires_at,null);
 jar.set('inchframe_studio_auth_v3',oldCookie);
 assert.equal(await auth.getChatGPTUser(),null);
 const login=load('app/api/auth/login/route.ts');
 const form=new FormData();form.set('email',email);form.set('password',password);
 assert.equal((await login.POST(new Request('https://studio.example/api/auth/login',{method:'POST',headers:{accept:'application/json'},body:form}))).status,401);
 await assert.rejects(()=>data.upsertAccountSsoUser({...identity,id:'other-account'}),/different Account identity/);
 assert.equal((await data.findStudioAccount(email)).account_user_id,identity.id);
 console.log('PASS: linking removes local credentials and verification tokens, revokes old sessions, preserves ownership and rejects identity reassignment.');

 await auth.createStudioSession(user,grant);
 assert.equal((await auth.getChatGPTUser()).userId,user.userId);
 const stolen=jar.get('inchframe_studio_auth_v3');
 await auth.clearStudioSession();jar.set('inchframe_studio_auth_v3',stolen);
 assert.equal(await auth.getChatGPTUser(),null);
 jar.clear();
 const opaque=tokens.createOpaqueToken();
 await data.createStudioSessionRecord(tokens.hashToken(opaque),user,new Date(Date.now()+60000).toISOString(),grant);
 jar.set('inchframe_studio_session_v2',opaque);
 assert.equal((await auth.getChatGPTUser()).userId,user.userId);
 await auth.clearStudioSession();jar.set('inchframe_studio_session_v2',opaque);
 assert.equal(await auth.getChatGPTUser(),null);
 jar.clear();
 const db=globalThis.inchframeStudioDb;
 await auth.createStudioSession(user,grant);
 db.prepare('UPDATE sessions SET expires_at=? WHERE user_id=?').run('2000-01-01T00:00:00.000Z',user.userId);
 assert.equal(await auth.getChatGPTUser(),null);
 const admin={userId:'admin:admin@example.invalid',email:'admin@example.invalid',displayName:'Admin',fullName:'Admin',role:'admin'};
 await auth.createStudioSession(admin);
 assert.equal((await auth.getChatGPTUser()).role,'admin');
 const adminCookie=jar.get('inchframe_studio_auth_v3');
 await auth.clearStudioSession();jar.set('inchframe_studio_auth_v3',adminCookie);
 assert.equal(await auth.getChatGPTUser(),null);
 console.log('PASS: signed and legacy cookies require active records; expired sessions and copied client/admin cookies fail after logout.');

 await auth.createStudioSession(user,grant);
 db.prepare("UPDATE users SET studio_access_status='suspended' WHERE id=?").run(user.userId);
 assert.equal(await auth.getChatGPTUser(),null);
 db.prepare("UPDATE users SET studio_access_status='active' WHERE id=?").run(user.userId);
 await auth.createStudioSession(user,grant);
 const migrationCookie=jar.get('inchframe_studio_auth_v3');
 db.prepare("UPDATE users SET password_hash=?,verification_token_hash='old-token' WHERE id=?").run(passwords.hashPassword(password),user.userId);
 db.prepare("DELETE FROM schema_migrations WHERE key='account-linked-credentials-v1'").run();
 globalThis.inchframeSchemaReady=false;
 await data.ensureSchema();
 jar.set('inchframe_studio_auth_v3',migrationCookie);
 assert.equal(await auth.getChatGPTUser(),null);
 assert.equal((await data.findStudioAccount(email)).password_hash,'');
 assert.equal((await data.findStudioAccount(email)).verification_token_hash,null);
 // Revocation timestamp is historical; allow deterministic fresh-login verification without a wall-clock sleep.
 db.prepare('UPDATE users SET sessions_revoked_at=? WHERE id=?').run('2000-01-01T00:00:00.000Z',user.userId);
 await auth.createStudioSession(user,grant);assert.ok(await auth.getChatGPTUser());
 console.log('PASS: suspension revokes access; startup migration removes previously linked passwords and invalidates existing sessions.');

 await auth.createStudioSession(user);
 assert.equal(await auth.getChatGPTUser(),null,'Old linked sessions without a grant must sign in again');
 await auth.createStudioSession(user,grant);
 accountUnavailable=true;assert.equal(await auth.getChatGPTUser(),null);
 accountUnavailable=false;assert.ok(await auth.getChatGPTUser(),'Outage must not destroy a still-valid session');
 grantActive=false;assert.equal(await auth.getChatGPTUser(),null);
 grantActive=true;assert.equal(await auth.getChatGPTUser(),null,'Fresh Account login must not revive the old Studio cookie');
 await auth.createStudioSession(user,grant);assert.ok(await auth.getChatGPTUser());
 reportedId='wrong-account';assert.equal(await auth.getChatGPTUser(),null);reportedId=identity.id;
 console.log('PASS: Account revocation, missing grants, identity mismatch and outages fail closed; fresh login cannot revive an old session.');
 let exchanges=0;
 global.fetch=async()=>{exchanges++;return Response.json({session_token:grant,session_expires_at:new Date(Date.now()+60000).toISOString(),user:{id:identity.id,email,email_verified:true,display_name:'Owner'},roles:[],entitlements:{tier:'pro',subscription_status:'active',studio_partner_eligible:true}});};
 const authorize=await sso.createAccountAuthorization('/portal?from=test','customer');
 const state=authorize.searchParams.get('state');
 await assert.rejects(()=>sso.finishAccountAuthorization('test-code',state,''),/this browser/);
 await assert.rejects(()=>sso.finishAccountAuthorization('test-code',state,'different-browser'),/this browser/);
 assert.equal(exchanges,0);
 const finished=await sso.finishAccountAuthorization('test-code',state,state);
 assert.equal(finished.user.userId,user.userId);
 assert.equal(finished.returnTo,'/portal?from=test');
 await assert.rejects(()=>sso.finishAccountAuthorization('test-code',state,state),/invalid or expired/);
 assert.equal(exchanges,1);
 const start=load('app/api/auth/account/start/route.ts');
 const response=await start.GET(new Request('https://studio.example/api/auth/account/start'));
 const binding=response.cookies.get(sso.STUDIO_SSO_STATE_COOKIE);
 assert.equal(response.status,303);assert.ok(binding);
 assert.equal(binding.httpOnly,true);assert.equal(binding.sameSite,'lax');assert.equal(binding.maxAge,600);
 assert.equal(binding.path,'/api/auth/account');
 assert.equal(binding.value,new URL(response.headers.get('location')).searchParams.get('state'));
 const expired=await sso.createAccountAuthorization('/portal','customer');
 const expiredState=expired.searchParams.get('state');
 db.prepare('UPDATE sso_login_transactions SET expires_at=? WHERE state_hash=?').run('2000-01-01T00:00:00.000Z',tokens.hashToken(expiredState));
 await assert.rejects(()=>sso.finishAccountAuthorization('test-code',expiredState,expiredState),/invalid or expired/);
 assert.equal(exchanges,1);
 console.log('PASS: SSO requires its initiating browser, rejects callback swapping/replay/expiry, and sets a bounded HttpOnly binding cookie.');
 console.log('Studio authentication regression passed; synthetic database only, no external requests.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{globalThis.inchframeStudioDb?.close();});
