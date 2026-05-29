# 生产镜像：连接外部 MySQL 与 Redis（DATABASE_URL、REDIS_URL 等由运行时环境变量注入）

FROM node:20-bookworm-slim AS deps

RUN apt-get update && apt-get install -y openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

FROM deps AS build

COPY prisma ./prisma
COPY scripts ./scripts
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm run prisma:generate && npm run build

FROM node:20-bookworm-slim AS runner

RUN apt-get update && apt-get install -y openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev \
  && npm install prisma@5.22.0 --no-save \
  && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

RUN node scripts/sync-prisma-provider.mjs && npx prisma generate

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
