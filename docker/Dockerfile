# syntax=docker/dockerfile:1.7
#
# ObjectOS runtime image
# -----------------------------------------------------------------------
# Multi-stage build producing a minimal Node 20 runtime that boots
# `apps/objectos` against either an Artifact API or a local artifact file.
# -----------------------------------------------------------------------

ARG NODE_VERSION=20
ARG PNPM_VERSION=10.28.2

# ---------- builder ----------
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/objectos/package.json apps/objectos/
COPY packages ./packages

RUN pnpm install --frozen-lockfile --filter "@objectos/app..."

COPY apps/objectos ./apps/objectos
RUN pnpm --filter @objectos/app build

# ---------- runtime ----------
FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate \
 && apk add --no-cache tini

COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/apps/objectos ./apps/objectos
COPY --from=builder /workspace/packages ./packages
COPY --from=builder /workspace/package.json /workspace/pnpm-lock.yaml /workspace/pnpm-workspace.yaml ./

RUN mkdir -p /var/cache/objectos /var/lib/objectos /artifacts
ENV NODE_ENV=production \
    OS_CACHE_DIR=/var/cache/objectos \
    PORT=3000

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" >/dev/null || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["pnpm", "--filter", "@objectos/app", "start"]
