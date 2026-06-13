import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@flow-analytics/shared'],
};

export default nextConfig;
