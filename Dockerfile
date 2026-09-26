# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build
RUN pnpm exec esbuild scripts/realtime-server.ts --bundle --platform=node --format=esm --packages=external --tsconfig=tsconfig.json --outfile=dist/realtime-server.mjs

FROM base AS prod-deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN groupadd --system --gid 1001 openstudyhub \
  && useradd --system --uid 1001 --gid openstudyhub --home-dir /app openstudyhub

COPY --from=prod-deps --chown=openstudyhub:openstudyhub /app/node_modules ./node_modules
COPY --from=builder --chown=openstudyhub:openstudyhub /app/.next ./.next
COPY --from=builder --chown=openstudyhub:openstudyhub /app/public ./public
COPY --from=builder --chown=openstudyhub:openstudyhub /app/package.json ./package.json
COPY --from=builder --chown=openstudyhub:openstudyhub /app/drizzle ./drizzle
COPY --from=builder --chown=openstudyhub:openstudyhub /app/v2-migrations ./v2-migrations
COPY --from=builder --chown=openstudyhub:openstudyhub /app/assets ./assets
COPY --from=builder --chown=openstudyhub:openstudyhub /app/dist/realtime-server.mjs ./dist/realtime-server.mjs
COPY --from=builder --chown=openstudyhub:openstudyhub /app/scripts/migrate-production.mjs ./scripts/migrate-production.mjs
COPY --from=builder --chown=openstudyhub:openstudyhub /app/scripts/migrate-v2-production.mjs ./scripts/migrate-v2-production.mjs
COPY --from=builder --chown=openstudyhub:openstudyhub /app/scripts/restore-manual-backup.mjs ./scripts/restore-manual-backup.mjs

RUN mkdir -p /app/data && chown -R openstudyhub:openstudyhub /app/data
USER openstudyhub

EXPOSE 3000
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const p=process.env.OPENSTUDYHUB_SURFACE==='admin'?'/control/login':'/api/health';fetch('http://127.0.0.1:3000'+p).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "node_modules/next/dist/bin/next", "start"]
