# Build context MUST be the monorepo root (npm workspaces need the root
# package-lock.json, and Next's standalone output preserves the apps/web/
# path prefix): `docker build -f apps/web/Dockerfile .`

# --- deps --------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci

# --- builder -------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY package.json package-lock.json ./
COPY apps/web ./apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace apps/web

# --- runtime -----------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
RUN addgroup -g 1000 investiq && adduser -u 1000 -G investiq -s /bin/sh -D investiq

COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/public ./apps/web/public

USER investiq
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0 NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
