import type { NextConfig } from "next";

const accessToken = process.env.ACCESS_TOKEN || "";
const apiDestination = accessToken
  ? `http://localhost:8091/api/:path*?access_token=${encodeURIComponent(accessToken)}`
  : "http://localhost:8091/api/:path*";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: apiDestination,
      },
    ];
  },
};

export default nextConfig;
