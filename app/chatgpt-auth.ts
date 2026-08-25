import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
  role: 'admin' | 'client';
};

type SessionPayload = ChatGPTUser & { exp: number; version: 1 };
const COOKIE_NAME = 'inchframe_studio_session';
const MAX_AGE = 60 * 60 * 24 * 7;

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== 'production') return 'inchframe-local-development-secret-change-me';
  throw new Error('AUTH_SECRET is not configured.');
}

function signature(value: string) {
  return createHmac('sha256', authSecret()).update(value).digest('base64url');
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function encodeSession(user: ChatGPTUser) {
  const payload: SessionPayload = {...user, exp: Date.now() + MAX_AGE * 1000, version: 1};
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${signature(encoded)}`;
}

function decodeSession(value: string): ChatGPTUser | null {
  const [encoded, suppliedSignature] = value.split('.');
  if (!encoded || !suppliedSignature || !safeEqual(signature(encoded), suppliedSignature)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (payload.version !== 1 || payload.exp < Date.now()) return null;
    if (!payload.userId || !payload.email || !['admin', 'client'].includes(payload.role)) return null;
    return {
      userId: payload.userId,
      email: payload.email,
      fullName: payload.fullName,
      displayName: payload.displayName || payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  return value ? decodeSession(value) : null;
}

export async function createStudioSession(user: ChatGPTUser) {
  (await cookies()).set(COOKIE_NAME, encodeSession(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function clearStudioSession() {
  (await cookies()).set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function requireChatGPTUser(returnTo: string) {
  const user = await getChatGPTUser();
  if (user) return user;
  redirect(`/login?returnTo=${encodeURIComponent(safeReturn(returnTo))}`);
}

export function chatGPTSignOutPath(returnTo = '/') {
  return `/api/auth/logout?returnTo=${encodeURIComponent(safeReturn(returnTo))}`;
}

export function safeReturn(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/portal';
  try {
    const url = new URL(value, 'https://studio.local');
    if (url.origin !== 'https://studio.local') return '/portal';
    if (['/login', '/register', '/api/auth/logout'].includes(url.pathname)) return '/portal';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/portal';
  }
}
