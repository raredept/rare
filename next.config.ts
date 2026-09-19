import type { NextConfig } from "next";
import { getSecurityHeaders } from "./src/lib/security-headers";
import { getServerActionDeploymentId } from "./src/lib/server-action-observability";

const deploymentId = getServerActionDeploymentId(process.env);
const restrictedEnvironment = ["staging", "preview", "homologation"].includes(process.env.APP_ENV?.trim().toLowerCase() ?? "");

const nextConfig: NextConfig = {
  output: "standalone",
  // Do not advertise the framework in every response.
  poweredByHeader: false,
  // Keep complete metadata in the initial head for crawlers and HTML auditors.
  // This waits for generateMetadata instead of streaming its tags into the body.
  htmlLimitedBots: /.*/,
  ...(deploymentId ? { deploymentId } : {}),
  // The image optimizer does not forward Basic credentials to local sources.
  // Protected previews serve images directly; production keeps optimization.
  ...(restrictedEnvironment ? { images: { unoptimized: true } } : {}),
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.raredept.com.br" }],
        destination: "https://raredept.com.br/:path*",
        permanent: true,
      },
      {
        source: "/cart",
        destination: "/finalizar-compra",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: getSecurityHeaders(),
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
