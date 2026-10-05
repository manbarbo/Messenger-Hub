# syntax=docker/dockerfile:1

# =============================================================================
# MessengerHub API + Worker — multi-stage build (monorepo root context)
#
# Build from repository root:
#   docker build -f apps/api/Dockerfile -t messengerhub-api:latest .
#
# Same image serves both processes:
#   API:    docker run ... <image>                      → node dist/main.js
#   Worker: docker run ... <image> node dist/worker-main.js
# =============================================================================

# --- Stage 1: install workspace deps and build Nest bundles ---

FROM node:20-alpine AS build

RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

WORKDIR /repo

# Workspace manifests first (layer cache)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json

RUN pnpm install --filter api... --frozen-lockfile

# Application source + Prisma schema
COPY apps/api ./apps/api

WORKDIR /repo/apps/api

RUN npx prisma generate \
  && pnpm --filter api build \
  && pnpm --filter api build:worker

# --- Stage 2: runtime (production deps only) ---

FROM node:20-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json

RUN pnpm install --filter api... --frozen-lockfile --prod

# Generated Prisma client + compiled dist (main.js + worker-main.js)
COPY --from=build /repo/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma
COPY --from=build /repo/apps/api/node_modules/@prisma ./apps/api/node_modules/@prisma
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma

WORKDIR /repo/apps/api

# Default: API process. ECS worker task overrides command to dist/worker-main.js
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1

CMD ["node", "dist/main.js"]
