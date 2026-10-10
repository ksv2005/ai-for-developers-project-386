# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.21.0

FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
RUN pnpm -r build
RUN pnpm --filter api deploy --prod /prod/api

FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production PORT=3000 STATIC_DIR=/app/public
WORKDIR /app
COPY --from=build /prod/api ./
COPY --from=build /repo/apps/web/dist ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/server.js"]
