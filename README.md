# CodecSiphon

面向「视频下载 / 订阅 / 配额与文件管理」的全栈初版：**后端**位于 `backend/`（NestJS），**前端**位于 `frontend/`（Vue 3 + Vite），侧边栏与页面划分对齐仓库内 `function&UI.md`。数据模型见 [docs/DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md)，架构见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 技术栈

| 层级 | 选型 |
|------|------|
| 运行时 | Node.js（建议 LTS ≥ 20） |
| 框架 | NestJS 11 |
| ORM / 迁移 | Prisma 5；**PostgreSQL**（默认）或 **MySQL**（`DATABASE_PROVIDER=mysql`，见 `backend/.env.example`） |
| 认证 | JWT（Access）+ 数据库存 Refresh Token（SHA-256 哈希） |
| 校验 | class-validator / class-transformer |
| Web UI | Vue 3、Vue Router、Pinia、Axios、Vite |

下载队列（**BullMQ** + **Redis**）与 **yt-dlp** Worker 已接入；前端已实现 **文件管理**（列表 / 搜索 / **下载到本机** / 删除）、**设置**（用户 `preferences` 与 `download_defaults`）、**帮助** 等页面。**订阅管理**相关前端入口暂时隐藏（后端 API 仍保留）。

## 仓库结构

```
CodecSiphon/
├── package.json             # npm workspaces 根（可在仓库根执行 npm install）
├── frontend/                # Vue 3 SPA（登录 / 仪表盘 / 任务 / 文件 / 设置 / 帮助；订阅页面临时隐藏）
├── backend/                 # NestJS API
│   ├── prisma/              # schema + migrations
│   ├── src/
│   │   ├── auth/            # 注册 / 登录 / refresh / logout
│   │   ├── tasks/           # 下载任务（创建 / 列表 / 状态 / 删除）
│   │   ├── media/           # 媒体文件列表 / 流式下载 / 删除
│   │   ├── subscriptions/   # 订阅源 CRUD
│   │   ├── settings/        # 当前用户 user_settings（GET / PATCH）
│   │   ├── download/        # BullMQ 队列 + yt-dlp Worker
│   │   └── prisma/          # PrismaService
│   ├── docker-compose.yml   # 本地 PostgreSQL + Redis
│   └── .env.example
├── docs/
│   ├── DATABASE_DESIGN.md
│   └── ARCHITECTURE.md
└── README.md
```

## 环境要求

- Node.js ≥ 20（推荐）
- Docker（可选，用于一键启动 PostgreSQL + Redis）
- 本地或远程 **PostgreSQL** 或 **MySQL**（与 `DATABASE_PROVIDER`、`DATABASE_URL` 一致；迁移说明见下）
- **Redis**（与 `REDIS_URL` 一致；BullMQ 入队与 Worker 消费需要；与 API 在同一进程内由 Nest 启动）。

可选：配置 **`YTDLP_PATH`** 或确保本机 PATH 中有 **yt-dlp**，否则下载 Worker 无法执行外部下载命令。

## 快速开始

### 1. 启动数据库（可选）

```bash
cd backend
docker compose up -d
```

默认与 `backend/.env.example` 中的连接串一致：`codec_siphon` / `codec_siphon`，数据库名 `codec_siphon`。同一 compose 会启动 **Redis**（默认 `localhost:6379`），与示例中的 `REDIS_URL` 一致。

### 2. 配置环境变量

在 `backend/` 目录下将 `.env.example` 复制为 `.env`（Windows：`copy .env.example .env`；macOS/Linux：`cp .env.example .env`）。

编辑 `.env`，至少设置：

- `DATABASE_PROVIDER`：`postgresql`（默认）或 `mysql`  
- `DATABASE_URL`：与所选类型一致的连接串（示例见 `.env.example`）  
- `JWT_SECRET`：**生产环境必填**，请使用足够长的随机串；本地开发若未设置，进程会使用内置临时密钥并打日志警告（重启后 token 会失效，建议仍从 `.env.example` 复制一行）。  

说明见 `backend/.env.example`。重要变量还包括 **`REDIS_URL`**（队列）、**`DOWNLOAD_ROOT`**（服务端存放媒体文件的根目录）、**`YTDLP_PATH`**（可选）及若干 **`YTDLP_*`** 站点相关参数。应用会优先读取 **`backend/.env`**（相对源码/编译目录解析，不依赖你从哪一级目录启动），再合并当前工作目录下的 `.env`（便于 monorepo 根目录覆盖变量）。若使用自带前端开发服务器，请在 `backend/.env` 中配置 **`FRONTEND_ORIGIN`**（默认已包含 `http://localhost:5173`），以便 CORS 通过；媒体文件下载接口会暴露 **`Content-Disposition`** 响应头（用于浏览器端解析建议文件名）。

### 3. 安装依赖与数据库迁移

在**仓库根目录**安装（推荐，使用 npm workspaces）：

```bash
npm install
```

或在仅使用 `backend/` 时：

```bash
cd backend
npm install
```

安装时会根据 **`backend/.env`** 中的 **`DATABASE_PROVIDER`**（默认 `postgresql`）将 `schema.postgresql.prisma` 或 `schema.mysql.prisma` 同步为 `prisma/schema.prisma`，再执行 `prisma generate`。**修改 Prisma 模型时**：编辑 `prisma/schema.postgresql.prisma`，运行 `npm run prisma:schemas`（会重新生成 MySQL 版 schema 并同步当前 provider 的 `schema.prisma`）。

数据库相关命令需在 `backend/` 下执行（或见下文「根目录脚本」）：

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
```

- **PostgreSQL**：`prisma/migrations` 下的 SQL 仅适用于 PostgreSQL；生产/本地用 `npm run prisma:migrate`（即 `migrate deploy`）。
- **MySQL**：请在 `.env` 中设置 `DATABASE_PROVIDER=mysql` 与 `DATABASE_URL`（`mysql://…`）。`npm install` / `npm run prisma:generate` 会选用 MySQL schema。**首个空库**可执行 `npm run prisma:db:push` 同步表结构；不要用当前迁移目录对 MySQL 跑 `migrate deploy`（迁移 SQL 为 PostgreSQL 专用）。

开发中若需改 schema 并生成新迁移（**仅 PostgreSQL**）：

```bash
cd backend
npm run prisma:migrate:dev
```

### 4. 启动 API

在仓库根目录：

```bash
npm run start:dev
```

或在 `backend/`：

```bash
cd backend
npm run start:dev
```

默认监听 `http://localhost:3000`（可用环境变量 `PORT` 修改）。

### 5. 启动前端（Vue）

在 `frontend/` 复制 `.env.example` 为 `.env`（可选；默认 API 为 `http://localhost:3000`）。

仓库根目录：

```bash
npm run start:dev:web
```

或在 `frontend/` 目录（与仓库根脚本等价）：

```bash
cd frontend
npm run dev
# 或
npm run start:dev:web
```

浏览器访问 **http://localhost:5173**。请先完成注册/登录，再使用「新建任务」「任务管理」「文件管理」等功能；文件管理支持将服务端 `DOWNLOAD_ROOT` 下的已入库媒体 **下载到本机**（需有效 JWT）。

### 6. 健康检查

```http
GET /health
```

数据库可达时返回 `200` 与 `database: "up"`；否则 `503`。

## 生产部署（Docker，仅应用镜像）

当 **PostgreSQL / MySQL 与 Redis 已在生产环境就绪** 时，可用 `deploy/docker-compose.yml` 一键构建并启动 **API + 前端（Nginx 静态资源）**（不包含数据库与 Redis 容器）。

1. 复制 `deploy/.env.example` 为 `deploy/.env` 并填写连接串与密钥（详见 [deploy/README.md](deploy/README.md)）。
2. 在仓库根目录执行：  
   `npm run deploy:up`  
   或在 `deploy/` 目录执行：  
   `docker compose up -d --build`

注意：前端 `VITE_API_URL` 在**构建**时写入；**yt-dlp** 需自行装入或挂载进 API 容器才能完成下载任务。

## API 摘要

所有 JSON 接口请求体需使用 `Content-Type: application/json`。除认证与健康检查外，业务接口需携带：

```http
Authorization: Bearer <access_token>
```

### 认证 ` /auth`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/register` | 注册（同时创建默认 `user_settings`） |
| POST | `/auth/login` | 登录 |
| POST | `/auth/refresh` | 使用 refresh token 轮换令牌 |
| POST | `/auth/logout` | 撤销 refresh token（`204 No Content`） |

登录 / 注册 / 刷新成功时返回 `accessToken`、`refreshToken` 及用户信息。

### 下载任务 `/tasks`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/tasks` | 创建任务；**`title` 必填**（1～500 字）；按 `sourceType` 校验 `sourceUrl` / `sourceUrls` / `subscriptionId`；请求体 `options` 与 **用户** `download_defaults`、**订阅** `download_options` **浅合并**，优先级为：默认 < 订阅 < 当前任务 `options` |
| GET | `/tasks` | 分页列表，`page`、`limit` 查询参数 |
| GET | `/tasks/:id` | 详情（仅当前用户） |
| PATCH | `/tasks/:id` | 更新状态：`paused`、`cancelled`、`queued`（暂停后续入队 / 取消 / 从暂停恢复或失败重试） |
| DELETE | `/tasks/:id` | 删除任务：移除队列作业、删除该任务目录下文件、清理关联媒体记录并回退用量（`204`） |

任务响应中的大数字段（如 `bytesDownloaded`）以 **字符串** 形式返回，便于前端处理。

### 媒体文件 `/media`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/media` | 分页列表；支持 `q` 按文件名筛选；`page`、`limit` |
| GET | `/media/:id/download` | **流式下载**到客户端（`Content-Disposition` 附件；路径经校验，仅限当前用户） |
| DELETE | `/media/:id` | 删除记录与磁盘文件并回退用量（`204`） |

列表中的 `sizeBytes` 为字符串。

### 订阅 `/subscriptions`（后端 API；**当前前端不提供管理界面**）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/subscriptions` | 创建订阅源（频道 / 播放列表 / RSS 等，见 DTO） |
| GET | `/subscriptions` | 分页列表；可选 `status`（`active` / `paused`） |
| GET | `/subscriptions/:id` | 详情 |
| PATCH | `/subscriptions/:id` | 更新 |
| DELETE | `/subscriptions/:id` | 删除（`204`） |

### 用户设置 `/settings`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/settings` | 返回 `preferences`、`downloadDefaults`、`multiUrlMaxLinks`（多条链接任务 URL 上限，来自环境变量 `MULTI_URL_MAX_LINKS`） |
| PATCH | `/settings` | 更新 `preferences` 与/或 `downloadDefaults`（`upsert`；需至少包含其一） |

## 常用脚本

在**仓库根目录**与 `backend/` 均可执行下列命令（根目录通过 `-w backend` 转发）：

| 命令 | 说明 |
|------|------|
| `npm run start:dev` | 后端开发模式（监听变更） |
| `npm run start:dev:web` | 前端 Vite 开发服务器 |
| `npm run build` | 编译 |
| `npm run test` | 单元测试 |
| `npm run prisma:generate` | 生成 Prisma Client |
| `npm run prisma:migrate` | 生产式迁移（`migrate deploy`） |

仅在 `backend/` 下还有：`npm run start:prod`（先 `npm run build`）等，见 `backend/package.json`。

## 相关文档

- [数据库设计](docs/DATABASE_DESIGN.md)
- [系统架构](docs/ARCHITECTURE.md)
- 界面与功能规划：仓库根目录 `function&UI.md`

## 许可证

`UNLICENSED`（见 `backend/package.json`）。
