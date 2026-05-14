import type { NextConfig } from "next";
import localConfig from "./local_next.config";

const vercelConfig: NextConfig = {
  serverExternalPackages: ['stripe'],

  async headers() {
    return [
      {
        // COOP + COEP — required for SharedArrayBuffer (ONNX WASM threads)
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=*, microphone=()',
          },
        ],
      },
      {
        // Scoped COEP for worker files
        source: '/workers/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },
        ],
      },
    ]
  },
};

export default process.env.VERCEL ? vercelConfig : localConfig;