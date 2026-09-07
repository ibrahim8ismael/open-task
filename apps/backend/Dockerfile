# syntax=docker/dockerfile:1.7
# Multi-stage build for the backend (NestJS + Prisma).
# NOTE: build context must be the REPO ROOT (see docker-compose*.yml) —
# the pnpm lockfile and workspace manifests live there.

FROM node:22-alpine AS base
# Pin pnpm to the version in the root package.json "packageManager" field
RUN npm install -g pnpm@11.10.0
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY patches ./patches
COPY apps/backend/package.json ./apps/backend/package.json
# Full package: pnpm symlinks it, and the backend tsconfig extends its files
COPY packages/typescript-config ./packages/typescript-config
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --filter=backend --frozen-lockfile --store-dir=/pnpm/store

FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
WORKDIR /app/apps/backend
# prisma.config.ts requires DATABASE_URL to be present even for `generate`
# (no connection is made).
RUN export DATABASE_URL=postgresql://placeholder && (pnpm db:generate || npx prisma generate)
EXPOSE 4040
CMD ["pnpm", "dev"]

FROM base AS build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY patches ./patches
COPY apps/backend/package.json ./apps/backend/package.json
# Full package: pnpm symlinks it, and the backend tsconfig extends its files
COPY packages/typescript-config ./packages/typescript-config
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --filter=backend --frozen-lockfile --store-dir=/pnpm/store
COPY apps/backend ./apps/backend
RUN export DATABASE_URL=postgresql://placeholder && pnpm --filter backend db:generate && pnpm --filter backend build

FROM node:22-alpine AS production
WORKDIR /app/backend
# Runtime deps only. prisma CLI (devDep) is added on top so the container
# can run `prisma migrate deploy` and the client can be generated here.
COPY apps/backend/package.json ./
# npm cannot handle pnpm "workspace:" protocol refs — strip them first.
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));for(const s of ['dependencies','devDependencies','peerDependencies','optionalDependencies']){for(const k of Object.keys(p[s]||{}))if(String(p[s][k]).startsWith('workspace:'))delete p[s][k]}fs.writeFileSync('package.json',JSON.stringify(p))" \
  && npm install --omit=dev --legacy-peer-deps && npm install --no-save --legacy-peer-deps "prisma@^7"
COPY apps/backend/prisma.config.ts ./
COPY apps/backend/prisma ./prisma
RUN DATABASE_URL=postgresql://placeholder ./node_modules/.bin/prisma generate
COPY --from=build /app/apps/backend/dist ./dist
ENV NODE_ENV=production
ENV PORT=4040
EXPOSE 4040
CMD ["node", "dist/main.js"]
