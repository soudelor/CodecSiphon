# 构建静态资源；API 地址在构建时通过 VITE_API_URL 写入（请指向公网可访问的后端根 URL）
FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY public ./public
COPY src ./src

ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:alpine

COPY nginx.docker.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
