import 'server-only';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

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

export function secretsEqual(left: string, right: string | undefined) {
  if (!right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
