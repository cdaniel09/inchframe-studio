import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getCreatorIconForViewer } from '@/lib/data';
import { readStoredFile } from '@/lib/storage';
export const runtime='nodejs';
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){const{id}=await params;const user=await getChatGPTUser();const icon=await getCreatorIconForViewer(id,user);if(!icon)return new Response('Not found.',{status:404});try{const value=await readStoredFile(icon.objectKey);return new Response(new Uint8Array(value),{headers:{'content-type':icon.mimeType,'content-length':String(value.byteLength),'cache-control':icon.public?'public, max-age=3600':'private, max-age=120','x-content-type-options':'nosniff'}});}catch{return new Response('Not found.',{status:404});}}
