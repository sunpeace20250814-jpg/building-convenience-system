# V4 Resident System — Server Dockerfile
#
# Multi-stage build:
#   1. deps   : install pnpm + all workspace deps (without native scripts)
#   2. build  : re-run install with native scripts (compiles better-sqlite3),
#               build @v4-resident/shared, compile server TS → dist/
#   3. runtime: node:22-alpine, runs `node dist/index.js`
#
# Design notes:
#   - Same node:22-alpine base for build & runtime → better-sqlite3 native
#     bindings built in stage 2 work in stage 3 without rebuild
#   - DATA_DIR=/data (volume) so SQLite file survives container restarts
#   - Non-root user (node) for security
#   - Healthcheck via /api/health

# ---------- Stage 1: deps ----------
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy only manifests for layer caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY client/package.json ./client/
COPY cli/package.json ./cli/

# Install all workspace deps without running scripts (deterministic, faster)
RUN pnpm install --frozen-lockfile --ignore-scripts

# ---------- Stage 2: build ----------
FROM deps AS build
WORKDIR /app

# Copy source code
COPY shared/ ./shared/
COPY server/ ./server/

# Re-run install WITH scripts now (compiles better-sqlite3 against this image)
RUN pnpm install --frozen-lockfile

# Build shared (workspace reference) then compile server
RUN pnpm --filter @v4-resident/shared run build
RUN pnpm --filter @v4-resident/server run build

# ---------- Stage 3: runtime ----------
FROM node:22-alpine AS runtime
LABEL org.opencontainers.image.title="v4-resident-server" \
      org.opencontainers.image.description="V4 大樓住戶管理系統後端 (Fastify + SQLite)"

# hadolint ignore=DL3018
RUN apk add --no-cache wget

WORKDIR /app

# Copy compiled server output
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/package.json ./package.json

# Copy server's node_modules wholesale. pnpm's structure (.pnpm virtual store
# + symlinks) is preserved by docker COPY. Native bindings (.node files) were
# compiled in stage 2 against the same node:22-alpine base, so they work here.
COPY --from=build /app/server/node_modules ./node_modules

# Persistent SQLite data
RUN mkdir -p /data && chown -R node:node /data
VOLUME ["/data"]
ENV DATA_DIR=/data \
    NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0

EXPOSE 3001

# Run as non-root
USER node

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1

CMD ["node", "dist/index.js"]
