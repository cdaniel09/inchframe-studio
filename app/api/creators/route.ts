import {getChatGPTUser} from '@/app/chatgpt-auth';
import {getAccountSsoEligibility,getCreatorApplicationForUser,saveCreatorApplication} from '@/lib/data';
import {sendCreatorApplicationEmails} from '@/lib/email';
import {deleteStoredFile,writeStoredFile} from '@/lib/storage';

export const runtime='nodejs';
const IMAGE_TYPES=new Set(['image/jpeg','image/png','image/webp']);
function text(form:FormData,key:string,max:number){return String(form.get(key)||'').trim().slice(0,max);}
function url(value:string){try{const parsed=new URL(value);return ['http:','https:'].includes(parsed.protocol)?parsed.toString():'';}catch{return '';}}

export async function POST(request:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:'Sign in required.'},{status:401});
  if(user.role!=='client')return Response.json({error:'Use a customer Account to apply.'},{status:403});
  if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Cross-site request rejected.'},{status:403});
  let form:FormData;
  try{form=await request.formData();}catch{return Response.json({error:'Invalid application.'},{status:400});}
  const existing=await getCreatorApplicationForUser(user),internalPartner=existing?.internal_partner===1;
  if(!internalPartner&&(form.get('proConfirmed')!=='yes'||form.get('contractorConfirmed')!=='yes'||form.get('contactConfirmed')!=='yes'||form.get('verificationConfirmed')!=='yes'))
    return Response.json({error:'Confirm Paid Pro eligibility, subcontractor status, the contact policy, and verification requirements.'},{status:400});
  const displayName=text(form,'displayName',80),headline=text(form,'headline',120),bio=text(form,'bio',1200);
  const specialties=text(form,'specialties',300),location=text(form,'location',100),availability=text(form,'availability',120);
  const inchframeEmail=text(form,'inchframeEmail',254).toLowerCase(),rateUnit=text(form,'rateUnit',20);
  const rateMin=Number(text(form,'rateMin',12)),rateMax=Number(text(form,'rateMax',12));
  if(!displayName||!headline||!bio||!specialties||!location||!availability||!inchframeEmail.includes('@')||
    !['project','day','hour'].includes(rateUnit)||!Number.isInteger(rateMin)||!Number.isInteger(rateMax)||
    rateMin<1||rateMax<rateMin||rateMax>1000000)
    return Response.json({error:'Complete the profile and enter a valid rate range.'},{status:400});
  if(existing&&existing.inchframe_email!==inchframeEmail)
    return Response.json({error:'The verified Inchframe account email cannot be changed on an existing Studio Partner profile.'},{status:400});
  const account=await getAccountSsoEligibility(user),accountLinked=account?.auth_source==='account';
  if(accountLinked&&inchframeEmail!==user.email.toLowerCase())
    return Response.json({error:'The application email must match your verified Inchframe Account.'},{status:400});
  if(!existing&&!account?.studio_partner_eligible)return Response.json({error:'An active paid Pro Account with Studio Partner eligibility is required.'},{status:403});
  const samples=[];
  for(let index=1;index<=5;index++){
    const title=text(form,`sampleTitle${index}`,100),sampleUrl=url(text(form,`sampleUrl${index}`,500));
    if(Boolean(title)!==Boolean(sampleUrl))return Response.json({error:`Add both a title and valid http(s) link for sample ${index}.`},{status:400});
    if(title&&sampleUrl)samples.push({title,url:sampleUrl});
  }
  const avatar=form.get('avatar');
  let avatarKey:string|undefined,avatarMime:string|undefined;
  if(avatar instanceof File&&avatar.size>0){
    if(!IMAGE_TYPES.has(avatar.type)||avatar.size>3*1024*1024)
      return Response.json({error:'Profile icon must be a JPG, PNG, or WebP no larger than 3 MB.'},{status:400});
    const extension=avatar.type==='image/png'?'png':avatar.type==='image/webp'?'webp':'jpg';
    avatarKey=`creators/${user.userId}/${crypto.randomUUID()}.${extension}`;
    avatarMime=avatar.type;
    await writeStoredFile(avatarKey,new Uint8Array(await avatar.arrayBuffer()));
  }
  try{
    const result=await saveCreatorApplication(user,{displayName,headline,bio,specialties,location,availability,inchframeEmail,
      rateUnit:rateUnit as 'project'|'day'|'hour',rateMin,rateMax,samples,avatarKey,avatarMime});
    if(avatarKey&&result.oldAvatarKey&&result.oldAvatarKey!==avatarKey)await deleteStoredFile(result.oldAvatarKey);
    try{await sendCreatorApplicationEmails({email:user.email,displayName,profileId:result.id,updated:Boolean(existing),internalPartner});}
    catch(error){console.error('Studio Partner application email failed',error);}
    return Response.json({id:result.id},{status:201});
  }catch(error){
    if(avatarKey)await deleteStoredFile(avatarKey);
    throw error;
  }
}
