import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Env vars z .env.local są automatycznie dostępne w API routes
  // NIE nadpisujemy ich tutaj — to powoduje race condition przy starcie
  experimental: {
    // Client-side cache for dynamic pages: returning to a recently visited
    // tab renders instantly from cache instead of a full server round-trip.
    // router.refresh() after mutations still forces fresh data.
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
