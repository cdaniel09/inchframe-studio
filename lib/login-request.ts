import 'server-only';

export class LoginRequestError extends Error {
  constructor(message:string,public status:number){super(message);}
}

// Bound actual bytes even when Content-Length is missing or forged.
export async function readLoginForm(request:Request) {
  const limit=16*1024;
  const declared=request.headers.get('content-length');
  if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>limit))
    throw new LoginRequestError('Sign-in request is too large.',413);
  if(!request.body)throw new LoginRequestError('Invalid sign-in request.',400);
  const reader=request.body.getReader();
  let timeout:ReturnType<typeof setTimeout>|undefined;
  const deadline=new Promise<never>((_,reject)=>{
    timeout=setTimeout(()=>reject(new LoginRequestError('Sign-in request timed out.',408)),10000);
  });
  try {
    const chunks:Uint8Array[]=[];let size=0;
    while(true){
      const next=await Promise.race([reader.read(),deadline]);
      if(next.done)break;
      size+=next.value.byteLength;
      if(size>limit)throw new LoginRequestError('Sign-in request is too large.',413);
      chunks.push(next.value);
    }
    const bytes=Buffer.concat(chunks);
    return await new Response(bytes,{headers:{'content-type':request.headers.get('content-type')||''}}).formData();
  } catch(error) {
    void reader.cancel().catch(()=>{});
    if(error instanceof LoginRequestError)throw error;
    throw new LoginRequestError('Invalid sign-in request.',400);
  } finally {
    clearTimeout(timeout);
    reader.releaseLock();
  }
}
