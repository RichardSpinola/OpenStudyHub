import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  devIndicators: false,
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
  distDir:
    process.env.NODE_ENV === "production"
      ? ".next"
      : process.env.OPENSTUDYHUB_QA_DIST_DIR === ".next-app-phase6"
        ? ".next-app-phase6"
        : process.env.OPENSTUDYHUB_SURFACE === "admin"
          ? ".next-admin"
          : process.env.OPENSTUDYHUB_SURFACE === "app"
            ? ".next-app"
            : ".next",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
