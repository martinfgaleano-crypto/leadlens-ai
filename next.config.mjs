/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@anthropic-ai/sdk"],
    // Admin Intelligence / Launch Readiness compute the capability plane from curated acceptance
    // artifacts read at runtime via fs (ml/data/acceptance/*.json) with a non-static root
    // (process.cwd()), which @vercel/nft cannot trace — so in the deployed lambda they were ABSENT and
    // the view model degraded to the last durable snapshot (a stale Aug-2026 evaluation, e.g. 76)
    // instead of computing the current readiness. Bundling them makes the deployed admin recompute
    // from current evidence.
    //
    // ONLY these two routes read the artifacts (both → loadAdminIntelligenceViewModel / admin-view-model).
    // Next matches these keys with picomatch `contains: true`, so each key matches ONLY its own route.
    // The earlier form also carried "/api/admin/intelligence" and "/api/admin/intelligence/**", which —
    // being substrings/globs — fanned the include across EVERY admin-intelligence route (incl. the
    // dynamic pilots/[pilotId]/* routes) and forced collect-build-traces to read a per-route trace file
    // for each; that built on macOS but failed the build on the Linux CI runner. Narrow keys + a
    // root-relative value glob (no leading "./") keep the fix's purpose while staying CI-safe.
    outputFileTracingIncludes: {
      "/api/admin/intelligence/launch-readiness": ["ml/data/acceptance/**/*.json"],
      "/api/admin/intelligence/command-center": ["ml/data/acceptance/**/*.json"],
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
