import 'server-only';

export function publicUrl(request: Request, path: string) {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredOrigin) {
    const origin = new URL(configuredOrigin);
    if (origin.protocol !== 'https:' && origin.protocol !== 'http:') throw new Error('NEXT_PUBLIC_SITE_URL must use HTTP or HTTPS.');
    return new URL(path, origin);
  }
  return new URL(path, request.url);
}
