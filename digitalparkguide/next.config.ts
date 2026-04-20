import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['stripe'],
  allowedDevOrigins: ['192.168.0.119'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=*, microphone=()',
          },
        ],
      },
    ]
  },
};

export default nextConfig;