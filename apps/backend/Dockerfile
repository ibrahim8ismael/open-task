# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PNPM_HOME/bin:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --filter=backend --offline --frozen-lockfile --store-dir=/pnpm/store || pnpm install --filter=backend --store-dir=/pnpm/store

FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
WORKDIR /app/apps/backend
RUN pnpm db:generate || npx prisma generate
EXPOSE 8000
CMD ["pnpm", "dev"]

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --offline --frozen-lockfile --store-dir=/pnpm/store || pnpm install --store-dir=/pnpm/store
RUN pnpm --filter backend db:generate && pnpm --filter backend build

FROM node:22-alpine AS production
WORKDIR /app/apps/backend
COPY --from=build /app/apps/backend/dist ./dist
COPY --from=build /app/apps/backend/package.json ./
COPY --from=build /app/apps/backend/prisma ./prisma
RUN npm install --omit=dev --ignore-scripts || true
EXPOSE 8000
CMD ["node", "dist/main.js"]
