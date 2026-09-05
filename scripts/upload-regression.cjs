// Real upload routes, SQLite and temporary files. No external services.
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {createRequire}=require('node:module'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),projectRequire=createRequire(path.join(root,'package.json')),ts=projectRequire('typescript');
const worker=process.argv.includes('--quota-worker');
if(!worker){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'inchframe-upload-regression-'));
 process.env.DATABASE_PATH=path.join(temp,'studio.sqlite');process.env.UPLOAD_DIR=path.join(temp,'uploads');
 process.env.AUTH_SECRET='isolated-upload-regression-secret';process.env.ADMIN_EMAIL='admin@example.invalid';process.env.STUDIO_ADMIN_EMAILS='';
}
let currentUser={userId:'upload-client',email:'client@example.invalid',displayName:'Client',fullName:'Client',role:'client'};
const cache=new Map();
function load(relative){
 const filename=path.join(root,relative);
 if(cache.has(filename))return cache.get(filename).exports;
 const module={exports:{}};cache.set(filename,module);
 const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 function localRequire(name){
  if(name==='server-only')return {};
  if(name==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>currentUser};
  if(name==='@/lib/email')return {sendCreatorApplicationEmails:async()=>{}};
  if(name.startsWith('@/'))return load(name.slice(2)+'.ts');
  return projectRequire(name);
 }
 new Function('require','module','exports',compiled)(localRequire,module,module.exports);
 return module.exports;
}
const data=load('lib/data.ts'),storage=load('lib/storage.ts'),requests=load('lib/upload-request.ts');
async function makeProject(owner=currentUser){
 const id=await data.createProject(owner,{title:'Upload test',projectType:'brand_film',brief:'Synthetic',audience:'',platforms:'',dueDate:null,budgetRange:'500_1000'});
 const projectId=typeof id==='string'?id:id.id;
 globalThis.inchframeStudioDb.prepare("UPDATE projects SET advanced_unlocked_at=?,status='production_ready' WHERE id=?").run(new Date().toISOString(),projectId);
 return projectId;
}
function child(projectId){
 return new Promise((resolve,reject)=>{
  const p=spawn(process.execPath,[__filename,'--quota-worker',projectId],{env:process.env,windowsHide:true});
  let out='',err='';p.stdout.on('data',value=>out+=value);p.stderr.on('data',value=>err+=value);
  p.on('error',reject);p.on('exit',code=>code===0?resolve(Number(out.trim())):reject(new Error(err)));
 });
}
async function main(){
 await data.ensureSchema();
 const db=globalThis.inchframeStudioDb;
 if(worker){
  try{await data.reserveUploadStorage(process.argv.at(-1),'race-owner',700*1024,1,1e12);console.log(1);}
  catch(error){if(error instanceof data.UploadQuotaError)console.log(0);else throw error;}return;
 }
 const route=load('app/api/projects/[id]/assets/route.ts'),projectId=await makeProject();
 const diskFiles=()=>fs.readdirSync(process.env.UPLOAD_DIR,{recursive:true,withFileTypes:true}).filter(entry=>entry.isFile()).map(entry=>path.join(entry.parentPath,entry.name));
 const count=()=>db.prepare('SELECT COUNT(*) n FROM assets').get().n;
 const held=()=>db.prepare('SELECT COUNT(*) n FROM upload_reservations').get().n;
 const form=(entries)=>{const form=new FormData();form.set('kind','seed');for(const [name,type,size=8]of entries)form.append('files',new Blob([new Uint8Array(size)],{type}),name);return form;};
 const post=(entries,headers={})=>route.POST(new Request('https://studio.example/api/projects/'+projectId+'/assets',{method:'POST',body:form(entries),headers}),{params:Promise.resolve({id:projectId})});
 const signedIn=currentUser;currentUser=null;assert.equal((await post([['good.png','image/png']])).status,401);currentUser={...signedIn,userId:'stranger'};assert.equal((await post([['good.png','image/png']])).status,404);currentUser=signedIn;
 assert.equal((await post([['good.png','image/png'],['bad.html','text/html']])).status,400);
 assert.equal(count(),0);assert.equal(held(),0);
 assert.equal((await post([['zero.png','image/png',0]])).status,400);
 assert.equal((await post([['good.png','image/png']],{'content-length':String(110*1024*1024)})).status,413);
 for(const headers of [{},{'content-length':'1'}]){
  await assert.rejects(()=>requests.readUploadForm(new Request('https://studio.example',{method:'POST',body:'x'.repeat(1000),
   headers:{'content-type':'multipart/form-data; boundary=test',...headers}}),128),error=>error.status===413);
 }
 let timeoutCallback;const originalTimeout=global.setTimeout;
 global.setTimeout=(callback)=>{timeoutCallback=callback;return 1;};
 const timed=requests.readUploadForm(new Request('https://studio.example',{method:'POST',duplex:'half',body:new ReadableStream({}),
   headers:{'content-type':'multipart/form-data; boundary=test'}}),128);
 global.setTimeout=originalTimeout;timeoutCallback();
 await assert.rejects(()=>timed,error=>error.status===408);
 let release;const blocking=requests.withUploadSlot(()=>new Promise(resolve=>release=resolve));
 assert.equal((await requests.withUploadSlot(async()=>new Response())).status,503);
 release(new Response());await blocking;
 assert.equal((await post([['first.png','image/png'],['second.png','image/png']])).status,201);
 assert.equal(count(),2);assert.equal(held(),0);
 const first=db.prepare('SELECT * FROM assets ORDER BY version LIMIT 1').get();
 assert.equal((await storage.readStoredFile(first.object_key)).length,8);
 const originalWrite=storage.writeStoredFile,originalDelete=storage.deleteStoredFile,originalError=console.error;
 console.error=()=>{};
 try{
  let writes=0;
  storage.writeStoredFile=async(...args)=>{await originalWrite(...args);if(++writes===2)throw new Error('Injected partial write failure');};
  assert.equal((await post([['partial-one.png','image/png'],['partial-two.png','image/png']])).status,503);
  assert.equal(count(),2);assert.equal(held(),0);assert.equal(diskFiles().length,2);
  storage.writeStoredFile=originalWrite;
  db.exec("CREATE TRIGGER fail_test_asset BEFORE INSERT ON assets WHEN NEW.filename='fail.png' BEGIN SELECT RAISE(ABORT,'test'); END;");
  assert.equal((await post([['before-fail.png','image/png'],['fail.png','image/png']])).status,503);
  assert.equal(count(),2);assert.equal(held(),0);assert.equal(diskFiles().length,2);db.exec('DROP TRIGGER fail_test_asset');
  storage.writeStoredFile=async(...args)=>{await originalWrite(...args);throw new Error('Injected write failure');};
  storage.deleteStoredFile=async()=>{throw new Error('Injected cleanup failure');};
  assert.equal((await post([['retained.png','image/png']])).status,503);
  assert.equal(count(),2);assert.equal(held(),1);
 }finally{storage.writeStoredFile=originalWrite;storage.deleteStoredFile=originalDelete;console.error=originalError;}
 // The only retained files are test-owned and remain charged until this explicit cleanup.
 assert.equal(diskFiles().length,3);
 for(const filename of diskFiles().filter(filename=>filename.endsWith('-retained.png')))await storage.deleteStoredFile(path.relative(process.env.UPLOAD_DIR,filename).split(path.sep).join('/'));
 const retained=db.prepare('SELECT id FROM upload_reservations').all();
 for(const item of retained)await data.releaseUploadStorage(item.id);
 console.log('PASS: bounded bodies/deadlines, one active upload, complete-batch validation, real writes, database rollback and retained quota on cleanup failure.');
 await assert.rejects(()=>data.reserveUploadStorage(projectId,currentUser.userId,1,1001,1e12),data.UploadQuotaError);
 process.env.STUDIO_PROJECT_STORAGE_LIMIT_MB='1';
 await assert.rejects(()=>data.reserveUploadStorage(projectId,currentUser.userId,2*1024*1024,1,1e12),data.UploadQuotaError);
 delete process.env.STUDIO_PROJECT_STORAGE_LIMIT_MB;
 process.env.STUDIO_OWNER_STORAGE_LIMIT_MB='1';
 await assert.rejects(async()=>data.reserveUploadStorage(await makeProject(),currentUser.userId,2*1024*1024,1,1e12),data.UploadQuotaError);
 delete process.env.STUDIO_OWNER_STORAGE_LIMIT_MB;
 await assert.rejects(()=>data.reserveUploadStorage(projectId,currentUser.userId,1024,1,512*1024*1024),data.UploadQuotaError);
 process.env.STUDIO_STORAGE_LIMIT_MB='1';
 const raceProject=await makeProject({...currentUser,userId:'race-owner'});
 const results=await Promise.all([child(raceProject),child(raceProject),child(raceProject)]);
 assert.equal(results.reduce((sum,value)=>sum+value,0),1);
 delete process.env.STUDIO_STORAGE_LIMIT_MB;
 for(const item of db.prepare('SELECT id FROM upload_reservations').all())await data.releaseUploadStorage(item.id);
 console.log('PASS: project/owner/disk limits and atomic global quota across three processes.');
 // Existing internal Partner profile can update while new applications remain paused.
 const oldKey='creators/upload-client/old.png';await storage.writeStoredFile(oldKey,new Uint8Array(8));
 const values={displayName:'Test',headline:'Film maker',bio:'Synthetic profile',specialties:'Film',location:'Test',availability:'Available',
  inchframeEmail:currentUser.email,rateUnit:'project',rateMin:1,rateMax:10,samples:[],avatarKey:oldKey,avatarMime:'image/png'};
 const profile=await data.saveCreatorApplication(currentUser,values);
 db.prepare('UPDATE creator_profiles SET internal_partner=1 WHERE id=?').run(profile.id);
 const creator=load('app/api/creators/route.ts'),application=new FormData();
 for(const [key,value]of Object.entries(values))if(typeof value==='string'||typeof value==='number')application.set(key,String(value));
 application.set('avatar',new Blob([new Uint8Array(9)],{type:'image/png'}),'new.png');
 storage.deleteStoredFile=async(key)=>{if(key===oldKey)throw new Error('Old icon is temporarily locked');return originalDelete(key);};
 console.error=()=>{};
 let updated;
 try{updated=await creator.POST(new Request('https://studio.example/api/creators',{method:'POST',body:application}));}
 finally{storage.deleteStoredFile=originalDelete;console.error=originalError;}
 assert.equal(updated.status,201);
 const saved=db.prepare('SELECT avatar_object_key FROM creator_profiles WHERE id=?').get(profile.id);
 assert.notEqual(saved.avatar_object_key,oldKey);
 assert.equal((await storage.readStoredFile(saved.avatar_object_key)).length,9);
 assert.equal(held(),1);
 const report=JSON.parse(require('node:child_process').execFileSync(process.execPath,[path.join(root,'scripts/review-upload-reservations.mjs')],{env:process.env,windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 assert.equal(report.reservations.length,1);assert.equal(report.reservations[0].files.length,2);assert.equal(report.reservations[0].files.filter(file=>file.referenced).length,1);
 console.log('PASS: profile replacement preserves its committed new icon if old-icon cleanup fails and retains a storage reservation.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>globalThis.inchframeStudioDb?.close());
