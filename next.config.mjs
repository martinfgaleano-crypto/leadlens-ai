/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@anthropic-ai/sdk"],
    // Admin Intelligence / Launch Readiness compute the capability plane from curated acceptance
    // artifacts read at runtime via fs (ml/data/acceptance/*.json). Serverless file-tracing does not
    // detect these dynamic reads, so in the deployed lambda they were ABSENT → the view model degraded
    // to the last durable snapshot (a stale Aug-2026 evaluation, e.g. 76) instead of computing the
    // current readiness. Bundling them makes the deployed admin recompute from current evidence.
    outputFileTracingIncludes: {
      "/api/admin/intelligence/launch-readiness": ["./ml/data/acceptance/**/*.json"],
      "/api/admin/intelligence": ["./ml/data/acceptance/**/*.json"],
      "/api/admin/intelligence/**": ["./ml/data/acceptance/**/*.json"],
    },
  },
  async redirects() {
    return [
      // Canonicalize the old landing path to the root (the landing now renders
      // at "/"). Permanent so search engines consolidate on leadlensintel.com/.
      { source: "/demo-pipeline", destination: "/", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
};

export default nextConfig;
