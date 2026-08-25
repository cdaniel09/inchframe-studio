import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
export type ChatGPTUser={userId:string;displayName:string;email:string;fullName:string|null};
export async function getChatGPTUser():Promise<ChatGPTUser|null>{const h=await headers();const userId=h.get('oai-authenticated-user-id');const email=h.get('oai-authenticated-user-email');if(!userId||!email)return null;const encoded=h.get('oai-authenticated-user-full-name');const fullName=encoded&&h.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'?safeDecode(encoded):null;return{userId,email,fullName,displayName:fullName??email};}
export async function requireChatGPTUser(returnTo:string){const user=await getChatGPTUser();if(user)return user;redirect(`/signin-with-chatgpt?return_to=${encodeURIComponent(safeReturn(returnTo))}`);}
export function chatGPTSignOutPath(returnTo='/'){return `/signout-with-chatgpt?return_to=${encodeURIComponent(safeReturn(returnTo))}`;}
function safeReturn(value:string){if(!value.startsWith('/')||value.startsWith('//'))return'/';try{const url=new URL(value,'https://app.local');if(url.origin!=='https://app.local'||['/signin-with-chatgpt','/signout-with-chatgpt','/callback'].includes(url.pathname))return'/';return`${url.pathname}${url.search}${url.hash}`;}catch{return'/';}}
function safeDecode(value:string){try{return decodeURIComponent(value);}catch{return null;}}
