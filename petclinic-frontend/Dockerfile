# Angular 16 refuses Node below ^16.14 || ^18.10; the tag this file used to carry (16.3)
# was under that floor and could never have built this app.
FROM node:18-bookworm-slim AS build

# @parcel/watcher is pinned at 2.0.4, which predates the per-platform prebuilt packages,
# so on any machine that is not the one that wrote the lockfile it compiles itself from
# source. Everything else in the lockfile — esbuild included — has its linux binaries
# listed, so this toolchain exists for that single dependency.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked npm ci

COPY . .
# `npm run build` is deliberately bypassed: its prebuild step regenerates api-types.ts
# from ../openapi.yaml, which sits outside this build context. That file is committed
# already, so the step has nothing to do here — and the strict wrapper it chains into
# fails the build on warnings the container has no way to act on.
RUN npx ng build --configuration docker

FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY proxy-backend.conf /etc/nginx/proxy-backend.conf

EXPOSE 4200

# 127.0.0.1, never `localhost`: nginx binds IPv4 only, while musl resolves localhost to
# ::1 first — the probe then gets a connection refused from a perfectly healthy server.
HEALTHCHECK --interval=5s --timeout=3s --retries=20 \
    CMD wget -qO- http://127.0.0.1:4200/healthz || exit 1
