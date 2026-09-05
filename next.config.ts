import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    // Authentication remains the access control; these pages must not be indexed.
    return [
      '/portal/:path*', '/api/:path*', '/start/:path*', '/login/:path*',
      '/register/:path*', '/verify-email/:path*', '/studio-partners/apply/:path*',
    ].map((source) => ({
      source,
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
    }));
  },
};
export default nextConfig;
