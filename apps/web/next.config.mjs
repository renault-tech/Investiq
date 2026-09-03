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
    // apps/web e apps/api são dois projetos Vercel em subdomínios
    // diferentes — toda chamada à API é "cross-origin" pro service worker,
    // e o runtimeCaching padrão do next-pwa trata isso com NetworkFirst
    // (10s de timeout, cache de 1h, sem filtro de status). Um cold start
    // do backend Python na Vercel passa fácil de 10s depois de um período
    // ocioso, e o NetworkFirst cai pro cache — inclusive de uma resposta de
    // erro (401 durante a renovação do token, por exemplo), fazendo a
    // sessão cair sem o token ter realmente expirado. Nenhuma chamada à API
    // deve ser cacheada ou servida do cache: sempre rede, sempre a resposta
    // de verdade. extendDefaultRuntimeCaching mantém o cache de páginas/
    // assets estáticos como estava; esta regra usa o mesmo urlPattern da
    // "cross-origin" padrão e entra registrada antes dela, então sempre
    // vence e a neutraliza.
    extendDefaultRuntimeCaching: true,
    runtimeCaching: [
      {
        urlPattern: ({ sameOrigin }) => !sameOrigin,
        handler: "NetworkOnly",
      },
    ],
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
