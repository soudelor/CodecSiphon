# CodecSiphon — 管理员模块代码变更记录

本文档记录**管理员模块相关**代码改动的**原因、方案与涉及文件**，便于回溯与 Code Review。需求依据见 [ADMIN_MODULE.md](./ADMIN_MODULE.md)，技术设计见 [ADMIN_MODULE_TECH_DESIGN.md](./ADMIN_MODULE_TECH_DESIGN.md)。

---

## 版本索引

| ID | 日期 | 摘要 |
|----|------|------|
| **AM-2026-05-19** | 2026-05-19 | P0：JWT `aud`、refresh `audience`、用户站 `UserAudienceGuard`、管理端 `POST /admin/auth/*` |
| **AM-2026-05-19-b** | 2026-05-19 | 管理端前端入口 **`/admin/<yyyymmdd>/...`**（须为当天）；裸 **`/admin`** 为空白占位，不重定向 |
| **AM-2026-05-19-c** | 2026-05-19 | Prisma **仅 MySQL**：基准迁移、`migration_lock.toml`、本地 compose 改为 MySQL、移除 PostgreSQL 双 schema |
| **AM-2026-05-19-d** | 2026-05-19 | MVP：管理端 **用户 / 任务 / 文件** REST + 前端视图（对齐 `ADMIN_MODULE.md` §2.2 U-01〜U-04、T-01〜T-07、F-01〜F-02） |
| **AM-2026-05-19-e** | 2026-05-19 | **T-08**：任务详情挂载 `mediaFiles`；**F-01**：用户文件列表前端筛选；任务详情跳转用户文件 `?taskId=` |
| **AM-2026-05-19-f** | 2026-05-19 | **U-05** `users.is_active/disabled_at`；**F-03** `DELETE /admin/media-files/:id`；**NF-01** `admin_audit_logs` + 登录/改写/删除写审计 |

---

## AM-2026-05-19-f — U-05 / F-03 / NF-01

- **U-05**：`users.is_active`、`users.disabled_at`（迁移 **`20260519180000_users_active_admin_audit`**）；用户站 **`login` / refresh**、管理端 **`loginAsAdmin` / refresh** 对停用账号拒绝；**`PATCH /admin/users/:id`** 白名单 **`isActive`**；列表 query **`isActive=true|false`**；禁止停用最后一个启用中的 admin、禁止操作者停用自身。
- **F-03**：**`DELETE /admin/media-files/:id`**，`MediaService.removeAsAdmin` 复用用户侧删除语义。
- **NF-01**：表 **`admin_audit_logs`**（**`AdminAuditService`** / 全局 **`AuditModule`**）：记录管理端 **`admin_auth.login_ok`**、**`admin_user.patch`**、**`admin_task.delete`**、**`admin_media.delete`**（可选 IP）。
- **模块**：**`MediaModule` 导出 `MediaService`**，**`AdminModule` 引入 `MediaModule`**。

---

## AM-2026-05-19-e — 任务详情入库文件（T-08）与用户文件筛选（F-01）

- **`GET /admin/tasks/:id`**：在同包响应中附带 **`mediaFiles`**（Prisma `findMany`，`WHERE task_id = :id`，`ORDER BY created_at DESC`，上限 **500**；字段：`id`、`fileName`、`relativePath`、`sizeBytes`、`mimeType`、`createdAt`）。
- **前端**：`AdminTaskDetailView` 表格展示 **`mediaFiles`**，并提供 **`/users/:ownerUserId/files?taskId=:task`** 穿透；`AdminUserMediaView` 将 **`fileNameContains` / `taskId` / `createdAfter` / `createdBefore`** 传入 **`GET /admin/users/:userId/media-files`**，支持 **`watch` `route.query.taskId`** 与 **`userId` 路由参数**切换时重载。

---

## AM-2026-05-19-d — 管理业务 API 与前台穿透（MVP）

- **范围**：`/admin/users`（列表、详情、`PATCH role|storageQuotaBytes|monthlyDownloadQuotaBytes`）、`/admin/tasks`（列表多维筛选、详情、`DELETE`，删除走 `TasksService.removeAsAdmin`）、`/admin/users/:userId/media-files` 列表与 `/admin/media-files/:id` 详情；**`AdminAuthGuard`**（JWT + `aud: admin` + `role: admin`）。
- **前端**：`/admin/:yyyymmdd` 下 **用户列表/详情/PATCH**、**任务列表/详情/删除**、**用户文件列表**、**单文件详情**；独立 **`adminApi` axios** 与侧边导航；主页快捷入口指向用户 / 任务。
- **后端涉及（摘要）**：`backend/src/admin/*`（`admin-users`、`admin-tasks`、`admin-media` controllers/services、`removeAsAdmin`）、`backend/src/tasks/tasks.module.ts` 导出 `TasksService`。

---

## AM-2026-05-19-c — Prisma 仅 MySQL（`npm run prisma:migrate`）

- **原因**：原 `prisma/migrations` 以 PostgreSQL 为主，MySQL 无法直接 `migrate deploy`；仓库决定 **不再支持 PostgreSQL**。
- **方案**：仅保留 **`prisma/schema.prisma`（MySQL）**；删除 `schema.postgresql.prisma` / `schema.mysql.prisma` 与 **`gen-mysql-schema.mjs`**；**`migration_lock.toml`** 改为 **`mysql`**；新增基准迁移 **`20260519120000_mysql_baseline`**（自 `prisma migrate diff` 生成的全库 DDL，含 **`refresh_tokens.audience`**）；移除旧 PG 迁移目录；**`backend/docker-compose.yml`** 改为 **MySQL 8.4 + Redis**；文档与 **`DATABASE_URL`** 示例改为 `mysql://…`。
- **破坏性**：已有 **PostgreSQL** 数据或基于旧迁移的部署，**不会**被本变更自动迁移；需自行导出/导入或新建 MySQL 库后执行 **`npm run prisma:migrate`**。
- **旧 MySQL 缺列**：迁移 **`20260519140000_refresh_tokens_audience_if_missing`** 会幂等补全 **`refresh_tokens.audience`**（与 `README` 数据库章节一致）。

---

## AM-2026-05-19-b — 管理端前端入口日期路径

- **原因**：降低随意探测固定 `/admin` 路径的可能；仅知道「当日」分段的管理员可进入。
- **行为**：` /admin` → **空白页**（不重定向）；路径中 8 位日期非 **浏览器本地当天** 则导航至站点根 `/`。
- **实现**：`frontend/src/utils/adminEntry.ts`；路由 ` /admin/:yyyymmdd/login`、 ` /admin/:yyyymmdd/...`；**` /admin`** → `AdminBlankView.vue`（空白占位）。

---

## AM-2026-05-19 — 双会话（用户站 / 管理端）与 P0 认证骨架

### 修改原因

1. 满足需求 **A-05 / §2.4**：**管理员 access 不得调用用户站业务 API**，须从协议层区分令牌。
2. 满足需求 **§9.3 / §9.4**：**用户 refresh 与管理员 refresh 分轨**，禁止交叉换发，数据库需可区分。
3. 为后续 `/admin/users`、`/admin/tasks` 等接口提供统一的 **`aud: admin` 鉴权基础**（下一批迭代实现）。

### 修改方案（概要）

| 项 | 方案 |
|----|------|
| **Access JWT** | 载荷增加 **`aud`: `user` \| `admin`**；**旧 token 无 `aud` 时 `JwtStrategy` 视为 `user`**，避免全员掉线。 |
| **Refresh** | 表 **`refresh_tokens`** 增加枚举列 **`audience`**（`user` / `admin`）；用户站登录/刷新仅使用 `user`；**`POST /admin/auth/login`** 仅 `role=admin` 成功，签发 **`aud: admin`** + **`audience: admin`** refresh。 |
| **用户站 Guard** | 新增 **`UserAudienceGuard`**：若 `req.user.aud === 'admin'` → **403**。挂在所有原 `AuthGuard('jwt')` 的用户业务控制器上（见下表）。 |
| **管理端路由** | 新增 **`AdminModule`**，暴露 **`POST /admin/auth/login|refresh|logout`**，内部复用 **`AuthService`** 新方法。 |

### 数据库迁移

- 本节后 **`prisma migrate`** 目录已随 **AM-2026-05-19-c** 替换为 **MySQL 基准迁移**（见该节）。历史上单独的 `audience` 补丁文件已合并进基准 SQL。
- 部署：**`npx prisma migrate deploy`**（指向 MySQL）并 **`npx prisma generate`**。

### 涉及文件清单

| 路径 | 说明 |
|------|------|
| `prisma/schema.prisma` | MySQL 唯一模型源；含 `RefreshAudience`、`RefreshToken.audience` |
| `prisma/migrations/20260519120000_mysql_baseline/migration.sql` | MySQL 全库基准（含 **`refresh_tokens.audience`**）；取代旧 PG 迁移链 |
| `src/auth/strategies/jwt.strategy.ts` | `JwtAccessPayload.aud`；`validate` 映射 `req.user.aud` |
| `src/auth/auth.service.ts` | `buildAuthResponse(sessionAudience)`；`login`→`user`；**`loginAsAdmin`**；`refresh`/`logout` 按 audience；`refreshAsAdmin`/`logoutAsAdmin` |
| `src/common/decorators/current-user.decorator.ts` | `AuthUser` 增加可选 **`aud`** |
| `src/common/guards/user-audience.guard.ts` | **新建**：拦截 admin token |
| `src/tasks/tasks.controller.ts` | `AuthGuard` + **`UserAudienceGuard`** |
| `src/settings/settings.controller.ts` | 同上 |
| `src/subscriptions/subscriptions.controller.ts` | 同上 |
| `src/media/media.controller.ts` | JWT 方法均加 **`UserAudienceGuard`**（`GET :id/file` 仍无 Bearer） |
| `src/url-extract/url-extract.controller.ts` | `parse` / `sample` 加 **`UserAudienceGuard`** |
| `src/admin/admin.module.ts` | **新建** |
| `src/admin/admin-auth.controller.ts` | **新建**：`/admin/auth` |
| `src/app.module.ts` | 注册 **`AdminModule`** |

### 运维与验证提示

- 上线后：用户**下次登录或刷新**即得到带 **`aud`** 的 access；**未迁移前**旧 refresh 行无 `audience` 列会导致 DB 报错——须**先迁移再发版**。
- Windows 若 **`prisma generate` EPERM**：停掉占用 `node_modules` 的进程（如 `npm run start:dev`）后重试 `npx prisma generate`。
- 手工验证：**管理端登录**拿 access 调 **`GET /tasks`** → **403**；用户 refresh 调 **`POST /admin/auth/refresh`** → **401**。

### 后续迭代（未在本次提交）

- **`AdminJwtGuard`**（仅允许 `aud: admin` + `role: admin` 调 `/admin/users` 等）。
- 管理端用户/任务/文件 **CRUD 与聚合**。
- 前端 **`/admin/login`** 与 **独立 axios 实例**。

---

*新增变更时在本文件顶部表格增加一行，并以「AM-日期-序号」为段落标题追加一节。*
