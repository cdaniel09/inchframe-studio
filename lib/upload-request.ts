import 'server-only';
import {mkdir,statfs} from 'node:fs/promises';
import {uploadRoot} from '@/lib/storage';
import {UploadQuotaError} from '@/lib/data';

export class UploadRequestError extends Error {
  constructor(message:string,public status:number){super(message);}
}
const state=globalThis as typeof globalThis & {studioUploadBusy?:boolean};
export async function withUploadSlot(work:()=>Promise<Response>){
  if(state.studioUploadBusy)return Response.json({error:'An upload is being processed. Please try again shortly.'},{status:503,headers:{'retry-after':'2'}});
  state.studioUploadBusy=true;
  try{return await work();}catch(error){
    if(error instanceof UploadRequestError||error instanceof UploadQuotaError)
      return Response.json({error:error.message},{status:error instanceof UploadQuotaError?507:error.status});
    console.error('Studio upload failed',error);
    return Response.json({error:'The upload could not be saved. Please try again.'},{status:503});
  }finally{state.studioUploadBusy=false;}
}
export async function freeUploadBytes(){
  await mkdir(uploadRoot(),{recursive:true});
  const info=await statfs(uploadRoot());
  return info.bavail*info.bsize;
}
export async function readUploadForm(request:Request,limit:number){
  const declared=request.headers.get('content-length');
  if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>limit))
    throw new UploadRequestError('The upload exceeds the allowed size. Use a smaller file or batch.',413);
  if(!request.body)throw new UploadRequestError('Choose files to upload.',400);
  const reader=request.body.getReader();let total=0;
  let timeout:ReturnType<typeof setTimeout>|undefined;
  const stream=new ReadableStream<Uint8Array>({
    start(controller){timeout=setTimeout(()=>{controller.error(new UploadRequestError('The upload timed out. Please retry.',408));void reader.cancel().catch(()=>{});},60000);},
    async pull(controller){
      try{
        const result=await reader.read();
        if(result.done){controller.close();return;}
        total+=result.value.byteLength;
        if(total>limit)throw new UploadRequestError('The upload exceeds the allowed size. Use a smaller file or batch.',413);
        controller.enqueue(result.value);
      }catch(error){controller.error(error);void reader.cancel().catch(()=>{});}
    },
    cancel(){void reader.cancel().catch(()=>{});},
  });
  try{
    return await new Response(stream,{headers:{'content-type':request.headers.get('content-type')||''}}).formData();
  }catch(error){
    if(error instanceof UploadRequestError)throw error;
    throw new UploadRequestError('Invalid upload form.',400);
  }finally{clearTimeout(timeout);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
