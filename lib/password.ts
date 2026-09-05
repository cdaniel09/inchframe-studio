import 'server-only';
import { randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('base64url');
  const hash = scryptSync(password, salt, 64).toString('base64url');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string | undefined) {
  if (!stored) return false;
  const [method, salt, expected] = stored.split('$');
  if (method !== 'scrypt' || !salt || !expected) return false;
  try {
    const actual = scryptSync(password, salt, 64);
    const expectedBuffer = Buffer.from(expected, 'base64url');
    return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
  } catch {
    return false;
  }
}

// Share capacity across module reloads in a Node process; do not queue excess work.
const work=globalThis as typeof globalThis & {studioPasswordChecks?:number};
export class PasswordWorkBusy extends Error {}
export async function verifyPasswordAsync(password:string,stored:string|undefined) {
  if((work.studioPasswordChecks||0)>=2)throw new PasswordWorkBusy('Sign-in is busy. Try again shortly.');
  work.studioPasswordChecks=(work.studioPasswordChecks||0)+1;
  try {
    const parts=stored?.split('$');
    const valid=parts?.length===3&&parts[0]==='scrypt'&&!!parts[1]&&parts[1].length<=128&&parts[2].length<=128;
    // Unknown or disabled identities perform the same bounded password work.
    const salt=valid?parts![1]:'studio-unknown-identity';
    const expected=valid?Buffer.from(parts![2],'base64url'):Buffer.alloc(64);
    const actual=await new Promise<Buffer>((resolve,reject)=>{
      scrypt(password,salt,64,(error,key)=>error?reject(error):resolve(key));
    });
    return !!valid&&actual.length===expected.length&&timingSafeEqual(actual,expected);
  } finally {
    work.studioPasswordChecks!--;
  }
}

export function secretsEqual(left: string, right: string | undefined) {
  if (!right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
