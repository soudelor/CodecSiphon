# 生产一键部署（仅应用代码）

前提：**MySQL 与 Redis 已在生产环境可用**，本编排只启动 **API** 与 **前端 Nginx**。

## 步骤

1. 安装 [Docker](https://docs.docker.com/get-docker/)（含 Compose V2）。
2. 在 `deploy/` 目录复制环境变量示例并编辑：

   ```bash
   cp .env.example .env
   ```

   必填：`DATABASE_URL`、`REDIS_URL`、`JWT_SECRET`、`FRONTEND_ORIGIN`、`VITE_API_URL`。

   - `FRONTEND_ORIGIN`：用户浏览器访问前端的 URL（与 CORS 一致）。
   - `VITE_API_URL`：用户浏览器访问后端的 API 根 URL（**无尾斜杠**）；会打进前端静态资源，修改后需重新构建 `web` 镜像。

3. 在 **`deploy/`** 目录执行：

   ```bash
   docker compose up -d --build
   ```

   默认：`api` 映射主机 `3000`，`web` 映射 `8080`。可在 `.env` 中改 `API_PORT`、`WEB_PORT`。

4. 首次启动时 API 容器会执行 **`prisma migrate deploy`**（对 **`prisma/migrations` 中的 MySQL DDL**）。若需自行同步表结构，可在 `.env` 中设置 `SKIP_PRISMA_MIGRATE=1`。

## 一键命令（在仓库根目录）

若在根目录 `package.json` 中已配置脚本，可执行：

```bash
npm run deploy:up
```

（仍须提前准备好 `deploy/.env`。）

## 下载目录与 yt-dlp

- 下载文件保存在 Docker 卷 `codec_siphon_downloads`（挂载为容器内 `/app/data/downloads`）。
- 镜像内需能执行 **yt-dlp** 才能完成下载任务。当前基础镜像未内置 yt-dlp，你可自行扩展 `backend/Dockerfile`（安装二进制）或将宿主机的 `yt-dlp` 挂载进容器，并配置 `YTDLP_PATH` 等环境变量（见 `backend/.env.example`）。

## 镜像与 Prisma

本仓库 **仅支持 MySQL**；`docker compose` 构建 **API** 镜像时**无需**再传 `DATABASE_PROVIDER`。运行时通过 **`DATABASE_URL`**（`mysql://…`）连接数据库。

## 传统部署（无 Docker）

目标：在已有 **Node.js** 的服务器上直接跑 **Nest API**，用 **Nginx（或同类）** 托管前端静态文件；**MySQL、Redis** 仍使用你已部署好的实例。

### 1. 在构建机（本机或 CI）打包

**环境**：Node.js ≥ 20，与生产一致更佳。

**后端**（在仓库根或 `backend/` 下）：

```bash
cd backend
cp .env.example .env
# 按生产填写 DATABASE_URL（mysql://…）、JWT_SECRET 等（用于 prisma generate / migrate，可指向生产库或临时库）
npm ci
npm run prisma:generate
npm run build
```

得到可部署目录大致需要包含：

- `backend/dist/`（编译结果）
- `backend/prisma/`（`schema*.prisma`、`migrations/`）
- `backend/scripts/`（`sync-prisma-provider.mjs` 等）
- `backend/package.json`、`backend/package-lock.json`

**生产安装依赖**（在服务器上用，避免把本机 `node_modules` 整包上传）：

```bash
cd backend
npm ci --omit=dev
npm install prisma@5.22.0 --no-save
node scripts/sync-prisma-provider.mjs
npx prisma generate
```

然后复制已构建的 **`dist/`** 覆盖到服务器同路径。

**前端**（构建时写入 API 地址）：

```bash
cd frontend
# Linux/macOS
export VITE_API_URL=https://api.example.com
npm ci
npm run build
```

产物为 **`frontend/dist/`** 目录下全部静态文件（html/js/css/assets）。不要把带 `localhost` 的构建结果直接用于生产。

可将 **`frontend/dist/*`** 整体同步到 Nginx 的站点根目录（如 `/var/www/codec-siphon`）。

### 2. 服务器上的配置与启动

- 在 **`backend/`** 放置生产 **`backend/.env`**（参考 `backend/.env.example`）：`DATABASE_URL`、`REDIS_URL`、`JWT_SECRET`、`FRONTEND_ORIGIN`（浏览器访问前端的 URL）、`PORT`、`DOWNLOAD_ROOT`、`YTDLP_PATH` 等。
- **首次或发版后**对 MySQL 执行迁移（仓库内为 **MySQL DDL**）：

  ```bash
  cd backend
  npm run prisma:migrate
  ```

  连接串见 **`DATABASE_URL`**（`mysql://…`）；需已创建空库且账号有权建表。

- 启动 API：

  ```bash
  cd backend
  npm run start:prod
  ```

  生产建议使用 **systemd**、**PM2** 或 **supervisor** 守护进程，并配置开机自启。

- **Nginx**：`root` 指向前端 `dist`；`location /` 使用 `try_files $uri $uri/ /index.html;` 以支持 Vue Router；反向代理 `/` 到 Node 仅在你打算同域时再配，当前前端默认可通过 `VITE_API_URL` 直连另一台/另一路径的 API。注意 **`FRONTEND_ORIGIN`** 与浏览器实际访问的前端 Origin 一致，否则 CORS 会失败。

### 3. 可选：打成发布包

在 CI 或本机脚本里可生成一个 **tar**，例如：

```text
release/
  backend/
    dist/
    prisma/
    scripts/
    package.json
    package-lock.json
  frontend-dist/    # 即 frontend/dist 的内容打平或整目录
```

上传服务器后：`backend` 目录内 `npm ci --omit=dev`、`prisma generate`、`prisma migrate deploy`（或 `npm run prisma:migrate`）、再 `npm run start:prod`；前端 **`frontend-dist`** 同步到 Nginx 根目录。

### 4. 与 Docker 方案的差异

| 项目 | 传统 | Docker |
|------|------|--------|
| Node / 系统库 | 自行安装并维护 | 镜像内固定 |
| yt-dlp | 装在宿主机 PATH 或配 `YTDLP_PATH` | 需自行装或挂载 |
| 下载目录 | `DOWNLOAD_ROOT` 指向服务器路径 | 卷或挂载 |
| 前端 API 地址 | 构建时 `VITE_API_URL` | 构建镜像时 ARG |

以上即「不用 Docker」时的代码打包与配置要点；细节仍以根目录 `README.md` 与 `backend/.env.example` 为准。
