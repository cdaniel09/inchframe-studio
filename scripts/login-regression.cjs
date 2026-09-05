// Real routes, SQLite and scrypt; no live accounts, mail or network.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {createRequire}=require('node:module'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),projectRequire=createRequire(path.join(root,'package.json'));
const ts=projectRequire('typescript'),worker=process.argv.includes('--rate-worker');
if(!worker){
 process.env.DATABASE_PATH=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'inchframe-login-regression-')),'studio.sqlite');
 process.env.AUTH_SECRET='isolated-login-regression-secret';
 process.env.ADMIN_EMAIL='admin@example.invalid';
 process.env.STUDIO_ADMIN_EMAILS='';
 process.env.STUDIO_AUTH_MODE='local';
 process.env.NEXT_PUBLIC_SITE_URL='https://studio.example';
 delete process.env.STUDIO_SSO_CLIENT_ID;delete process.env.STUDIO_SSO_CLIENT_SECRET;
}
const jar=new Map(),cache=new Map();
function load(relative){
 const filename=path.join(root,relative);
 if(cache.has(filename))return cache.get(filename).exports;
 const module={exports:{}};cache.set(filename,module);
 const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 function localRequire(name){
  if(name==='server-only')return {};
  if(name==='next/headers')return {cookies:async()=>({get:name=>jar.has(name)?{value:jar.get(name)}:undefined,set:(name,value)=>jar.set(name,value)})};
  if(name.startsWith('@/'))return load(name.slice(2)+'.ts');
  return projectRequire(name);
 }
 new Function('require','module','exports',compiled)(localRequire,module,module.exports);
 return module.exports;
}
const data=load('lib/data.ts'),passwords=load('lib/password.ts');
function child(){
 return new Promise((resolve,reject)=>{
  const p=spawn(process.execPath,[__filename,'--rate-worker'],{env:process.env,windowsHide:true});
  let out='',err='';p.stdout.on('data',value=>out+=value);p.stderr.on('data',value=>err+=value);
  p.on('error',reject);p.on('exit',code=>code===0?resolve(Number(out.trim())):reject(new Error(err)));
 });
}
async function main(){
 if(worker){
  let accepted=0;for(let i=0;i<10;i++)if(await data.checkRateLimit('parallel-login-test','shared',3,60000))accepted++;
  console.log(accepted);return;
 }
 await data.ensureSchema();
 const db=globalThis.inchframeStudioDb,login=load('app/api/auth/login/route.ts');
 const password='a-valid-test-password',hash=passwords.hashPassword(password);
 process.env.ADMIN_PASSWORD_HASH=hash;
 const original=passwords.verifyPasswordAsync;
 let checks=0;passwords.verifyPasswordAsync=(...args)=>{checks++;return original(...args);};
 const post=(email,pass=password,headers={})=>login.POST(new Request('https://studio.example/api/auth/login',{
  method:'POST',headers:{accept:'application/json',...headers},
  body:new URLSearchParams({email,password:pass,returnTo:'/portal?welcome=1'})
 }));
 const reset=()=>db.prepare('DELETE FROM request_limits').run();
 for(let i=0;i<5;i++)assert.equal((await post('unknown@example.invalid','wrong')).status,401);
 const previous=checks;
 const limited=await post(' UNKNOWN@EXAMPLE.INVALID ','wrong',{'x-forwarded-for':'random-spoofed-value'});
 assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'900');assert.equal(checks,previous);
 reset();
 for(let i=0;i<5;i++)assert.equal((await post(process.env.ADMIN_EMAIL,'wrong')).status,401);
 assert.equal((await post(process.env.ADMIN_EMAIL)).status,429);
 db.prepare('UPDATE request_limits SET window_started=?').run(Date.now()-16*60000);
 assert.equal((await post(process.env.ADMIN_EMAIL)).status,200);
 assert.ok(jar.has('inchframe_studio_auth_v3'));
 reset();
 const email='local@example.invalid';
 await data.createStudioAccount({email,displayName:'Test',passwordHash:hash,verificationTokenHash:'test-only',verificationExpiresAt:new Date(Date.now()+60000).toISOString()});
 assert.equal((await post(email)).status,401);
 db.prepare('UPDATE users SET email_verified_at=? WHERE email=?').run(new Date().toISOString(),email);
 const good=await post(email);assert.equal(good.status,200);assert.equal((await good.json()).redirectTo,'/portal?welcome=1');
 db.prepare("UPDATE users SET auth_source='account',account_user_id='account-test' WHERE email=?").run(email);
 assert.equal((await post(email)).status,401);
 console.log('PASS: email/admin limits, cooldown recovery, verified login, and linked-profile restrictions.');
 reset();
 for(let i=0;i<60;i++)assert.equal(await data.checkRateLimit('native-login-global','all',60,60000),true);
 const countBefore=checks;
 assert.equal((await post('other@example.invalid','wrong',{'x-forwarded-for':'new-forged-address'})).status,429);
 assert.equal(checks,countBefore);
 reset();
 for(const headers of [{},{'content-length':'1'},{'content-length':'20000'}]){
  const response=await login.POST(new Request('https://studio.example/api/auth/login',{method:'POST',
   headers:{accept:'application/json','content-type':'application/x-www-form-urlencoded',...headers},body:'x'.repeat(17000)}));
  assert.equal(response.status,413);
 }
 const form=new FormData();form.set('email','multipart@example.invalid');form.set('password','wrong');
 assert.equal((await login.POST(new Request('https://studio.example/api/auth/login',{method:'POST',body:form,headers:{accept:'application/json'}}))).status,401);
 globalThis.studioPasswordChecks=2;
 assert.equal((await post('busy@example.invalid')).status,503);
 globalThis.studioPasswordChecks=0;
 let yielded=false;setImmediate(()=>{yielded=true;});
 const first=original(password,hash),second=original('wrong',hash);
 await assert.rejects(()=>original(password,hash),passwords.PasswordWorkBusy);
 assert.deepEqual(await Promise.all([first,second]),[true,false]);assert.equal(yielded,true);
 assert.equal(globalThis.studioPasswordChecks,0);
 assert.equal(await original(password,undefined),false);
 const results=await Promise.all([child(),child(),child()]);
 assert.equal(results.reduce((sum,value)=>sum+value,0),3);
 console.log('PASS: shared cap resists header spoofing, bodies bounded, scrypt concurrency bounded/nonblocking, SQLite reservations atomic across 3 processes.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>globalThis.inchframeStudioDb?.close());
