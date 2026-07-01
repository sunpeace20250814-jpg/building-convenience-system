# V4 Resident System — Client Dockerfile
#
# Multi-stage build:
#   1. deps   : install pnpm + workspace deps
#   2. build  : build:font (subset CJK font) + tsc typecheck + vite build → dist/
#   3. runtime: nginx:alpine serving dist/, with /api/* reverse-proxied to api:3001
#
# Notes:
#   - build:font downloads Noto Sans TC subset from the internet (needs network)
#   - SPA fallback in nginx.conf → all non-/api routes serve index.html
#   - The /api location proxies to the `api` service defined in docker-compose.yml

# ---------- Stage 1: deps ----------
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy workspace manifests for layer caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY client/package.json ./client/
COPY cli/package.json ./cli/

# Install workspace deps (need shared/typescript for tsc to resolve @shared/*)
RUN pnpm install --frozen-lockfile --ignore-scripts

# ---------- Stage 2: build ----------
FROM deps AS build
WORKDIR /app

# Copy source
COPY shared/ ./shared/
COPY client/ ./client/

# Build shared first (client imports @shared via vite alias + tsc path)
RUN pnpm --filter @v4-resident/shared run build

# Build client: build:font (downloads Noto Sans TC subset) → tsc → vite build
# build:font needs network. We allow the default 60s timeout per font task.
RUN pnpm --filter @v4-resident/client run build

# ---------- Stage 3: runtime ----------
FROM nginx:1.27-alpine AS runtime
LABEL org.opencontainers.image.title="v4-resident-client" \
      org.opencontainers.image.description="V4 大樓住戶管理系統前端 (React + Vite, served by nginx)"

# Replace default config with our SPA + reverse-proxy setup
RUN rm -f /etc/nginx/conf.d/default.conf
COPY client/nginx.conf /etc/nginx/conf.d/v4.conf

# Static assets
COPY --from=build /app/client/dist /usr/share/nginx/html

# Healthcheck: verify nginx is serving and index.html is reachable
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

EXPOSE 80

# nginx:alpine's default CMD is `nginx -g "daemon off;"` — keep it
CMD ["nginx", "-g", "daemon off;"]
