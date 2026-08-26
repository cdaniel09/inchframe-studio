import 'server-only';
import { createHash, randomBytes } from 'node:crypto';

export function createOpaqueToken() {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createProjectAccessCode() {
  const raw = randomBytes(6).toString('hex').toUpperCase();
  return `IF-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

export function normalizeProjectAccessCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function hashProjectAccessCode(code: string) {
  return hashToken(normalizeProjectAccessCode(code));
}
