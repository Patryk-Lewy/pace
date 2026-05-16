import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Env vars z .env.local są automatycznie dostępne w API routes
  // NIE nadpisujemy ich tutaj — to powoduje race condition przy starcie
};

export default nextConfig;
