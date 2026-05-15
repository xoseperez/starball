# syntax=docker/dockerfile:1.7
#
# Single-container image: serves the SPA bundle AND the JSON API from the
# same Hono process. Multi-stage so the runtime stage doesn't carry the
# native-build toolchain (python3 + make + g++) or the Vite/TypeScript
# dev-time dependency tree.

# ---------------------------------------------------------------------------
# Stage 1: build the SPA bundle (Vite → /dist)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts index.html ./
COPY src/ ./src/
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: install the API's production deps (compiles better-sqlite3
# against a build toolchain that does NOT ship in the runtime stage)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS api-builder

WORKDIR /app/server

RUN apk add --no-cache python3 make g++

COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev

# ---------------------------------------------------------------------------
# Stage 3: runtime — node + compiled deps + source + built bundle
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime

WORKDIR /app/server

# Compiled native module + JS deps from stage 2.
COPY --from=api-builder /app/server/node_modules ./node_modules

# Server source.
COPY server/package.json server/tsconfig.json ./
COPY server/src/ ./src/

# Shared frontend logic the replay validator imports (physics + scoring +
# mapgen). The empty package.json at /app marks the subtree as ESM so tsx
# resolves the .ts modules correctly.
COPY src/ /app/src/
RUN printf '{ "type": "module" }\n' > /app/package.json

# Built SPA bundle.
COPY --from=frontend-builder /app/dist ./public

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DB_PATH=/var/lib/starball/scores.db

VOLUME ["/var/lib/starball"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --spider --quiet http://127.0.0.1:3000/health || exit 1

CMD ["npm", "start"]
