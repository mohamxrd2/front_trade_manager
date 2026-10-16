import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Cache du routeur client : revenir sur une page récemment visitée ne
    // redemande pas le payload de route au serveur (navigation instantanée,
    // les données elles-mêmes restant servies par le cache TanStack Query).
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ik.imagekit.io',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
