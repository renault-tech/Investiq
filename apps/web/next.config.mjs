import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig = {
  turbopack: {},
  // "standalone" is only for self-hosting (apps/web/Dockerfile) — Vercel has
  // its own serverless build output format and expects the plain .next
  // build, not the standalone server bundle. process.env.VERCEL is set
  // automatically by Vercel's build environment.
  output: process.env.VERCEL ? undefined : "standalone",
};

export default withPWA(nextConfig);
