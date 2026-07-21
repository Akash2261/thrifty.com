# Builds and runs apps/server. Build context must be the repo root (not apps/server) since the
# server depends on the packages/shared npm workspace — e.g. `docker build -f Dockerfile .` from
# the repo root, or point your hosting platform's "Dockerfile path"/"context" at the repo root.

FROM node:20-alpine AS builder
WORKDIR /repo

# Install once, keyed off lockfile + package.json files only, so source-only changes don't bust
# the dependency-install cache layer.
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

# packages/shared must be compiled before apps/server (server imports its dist output).
COPY packages/shared packages/shared
RUN npm run build --workspace=@thrifty/shared

COPY apps/server apps/server
RUN npm run prisma:generate --workspace=@thrifty/server
RUN npm run build --workspace=@thrifty/server

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /repo/packages/shared/dist ./packages/shared/dist
COPY --from=builder /repo/apps/server/package.json ./apps/server/package.json
COPY --from=builder /repo/apps/server/dist ./apps/server/dist
COPY --from=builder /repo/apps/server/prisma ./apps/server/prisma

WORKDIR /repo/apps/server
EXPOSE 4000

# Applies any pending migrations (safe/idempotent, unlike `migrate dev`) before every boot, then
# starts the server. See DEPLOYMENT.md for what env vars this needs and how to wire this into
# your specific host (some platforms prefer a separate "release command" instead — either works).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
