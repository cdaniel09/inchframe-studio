import {getChatGPTUser} from '@/app/chatgpt-auth';
import {addAssetBatch,checkRateLimit,getProjectForUser,isStudioAdmin,productionAgreementReady,reserveUploadStorage,releaseUploadStorage,setUploadReservationObjects} from '@/lib/data';
import {deleteStoredFile,writeStoredFile} from '@/lib/storage';
import {freeUploadBytes,readUploadForm,withUploadSlot} from '@/lib/upload-request';

export const runtime='nodejs';
const IMAGE_TYPES=new Set(['image/jpeg','image/png','image/webp']);
const VIDEO_TYPES=new Set(['video/mp4','video/webm']);
const AUDIO_TYPES=new Set(['audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/x-m4a','audio/aac']);

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in required.'},{status:401});
  if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Cross-site request rejected.'},{status:403});
  const{id}=await params;const project=await getProjectForUser(id,user);if(!project)return Response.json({error:'Project not found.'},{status:404});
  const admin=isStudioAdmin(user),creator=!admin&&project.owner_id!==user.userId,productionUploader=admin||creator;
  if(!admin&&!project.advanced_unlocked_at)return Response.json({error:'The project payment must be confirmed before media uploads.'},{status:403});
  if(!await checkRateLimit('media-upload',user.userId,30,3600000))
    return Response.json({error:'Too many uploads. Please try again in an hour.'},{status:429,headers:{'retry-after':'3600'}});
  return withUploadSlot(async()=>{
    const form=await readUploadForm(request,100*1024*1024+128*1024);
    let kind=String(form.get('kind')||'seed');if(!productionUploader&&!['seed','audio'].includes(kind))kind='seed';
    if(!['seed','audio','review','deliverable'].includes(kind))return Response.json({error:'Invalid file type.'},{status:400});
    if(productionUploader&&['review','deliverable'].includes(kind)&&!await productionAgreementReady(id))
      return Response.json({error:'Activate the client-approved production agreement before uploading review or delivery work.'},{status:409});
    const label=String(form.get('label')||'').trim().slice(0,120);
    const files=form.getAll('files').filter((entry):entry is File=>entry instanceof File);
    if(!files.length||files.length>12)return Response.json({error:'Choose between 1 and 12 files.'},{status:400});
    let bytes=0;
    // Validate every file before reserving capacity or creating any file.
    for(const file of files){
      const isImage=IMAGE_TYPES.has(file.type),isVideo=VIDEO_TYPES.has(file.type),isAudio=AUDIO_TYPES.has(file.type);
      const matchesKind=kind==='audio'?isAudio:kind==='seed'?isImage:productionUploader&&(isImage||isVideo);
      if(!matchesKind||file.size===0)return Response.json({error:`Unsupported or empty file: ${file.name}`},{status:400});
      const limit=isImage?15*1024*1024:isAudio?50*1024*1024:100*1024*1024;
      if(file.size>limit)return Response.json({error:`${file.name} exceeds the ${isImage?15:isAudio?50:100} MB limit.`},{status:413});
      bytes+=file.size;
    }
    if(bytes>100*1024*1024)return Response.json({error:'Send at most 100 MB of files per batch.'},{status:413});
    const reservation=await reserveUploadStorage(id,project.owner_id,bytes,files.length,await freeUploadBytes());
    const written:string[]=[];let committed=false;
    try{
      const inputs=[];
      for(const file of files){
        const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'-').slice(-100)||'upload';
        const key=`projects/${id}/${kind}/${crypto.randomUUID()}-${safeName}`;
        written.push(key); // Include partial writes in cleanup.
        await setUploadReservationObjects(reservation,written);
        await writeStoredFile(key,new Uint8Array(await file.arrayBuffer()));
        inputs.push({kind,objectKey:key,filename:file.name.slice(0,180),mimeType:file.type,byteSize:file.size,label});
      }
      await addAssetBatch(user,id,inputs,reservation);committed=true;
      return Response.json({count:files.length},{status:201});
    }finally{
      if(!committed){
        const removed=await Promise.allSettled(written.map(key=>deleteStoredFile(key)));
        // Failed cleanup keeps its reservation, so leaked files cannot free capacity.
        if(removed.every(result=>result.status==='fulfilled'))await releaseUploadStorage(reservation);
        else console.error('Upload cleanup needs review; reservation retained',reservation);
      }
    }
  });
}
