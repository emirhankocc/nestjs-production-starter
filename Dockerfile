# syntax=docker/dockerfile:1

FROM node:22.23.1-bookworm-slim AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

FROM node:22.23.1-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src

ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"

RUN npx prisma generate
RUN npm run build

FROM node:22.23.1-bookworm-slim AS production

ENV NODE_ENV=production

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nestjs \
  && useradd --system --uid 1001 --gid nestjs --home-dir /app nestjs

COPY package.json package-lock.json ./

# Prisma CLI is included intentionally for one-off `prisma migrate deploy` commands.
RUN npm ci --omit=dev \
  && npm install prisma@7.8.0 --no-save \
  && npm cache clean --force

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY scripts/docker-healthcheck.mjs ./scripts/docker-healthcheck.mjs
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

RUN chown -R nestjs:nestjs /app

USER nestjs

EXPOSE 3000

CMD ["node", "dist/src/main.js"]
