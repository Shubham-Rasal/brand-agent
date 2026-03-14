import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ['@filoz/synapse-sdk', '@filoz/synapse-core', 'sharp'],
  async rewrites() {
    return [
      { source: '/.well-known/agent-card.json', destination: '/api/agent-card' },
    ];
  },
};

export default nextConfig;
