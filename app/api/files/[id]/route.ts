import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getAssetForUser } from '@/lib/data';
import { readStoredFile } from '@/lib/storage';

export const runtime = 'nodejs';

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}) {
  const user=await getChatGPTUser();
  if(!user)return new Response('Sign in required.',{status:401});
  const{id}=await params;
  const asset=await getAssetForUser(id,user);
  if(!asset)return new Response('Not found.',{status:404});
  try{
    const object=await readStoredFile(asset.object_key);
    const filename=asset.filename.replace(/["\r\n]/g,'_');
    return new Response(new Uint8Array(object),{headers:{
      'content-type':asset.mime_type,
      'content-length':String(object.byteLength),
      'content-disposition':`inline; filename="${filename}"`,
      'cache-control':'private, max-age=300',
      'x-content-type-options':'nosniff',
    }});
  }catch{
    return new Response('Not found.',{status:404});
  }
}
