import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: 'http://127.0.0.1:3000/api/:path*' }];
  },
  poweredByHeader: false,
  compress: true,
};
export default nextConfig;
