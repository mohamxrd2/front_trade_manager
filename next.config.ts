import type { NextConfig } from "next";

import { mediaRemotePatterns } from "./lib/media/remote-hosts";

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
    // Bucket R2, API locale, avatars Google/Facebook — voir lib/media/remote-hosts.ts.
    remotePatterns: mediaRemotePatterns(),
  },
};

export default nextConfig;
