# 管理员模块 — 技术设计（实现草案）

本文档承接 **[ADMIN_MODULE.md](./ADMIN_MODULE.md)**（需求 v0.4），给出后端/前端/数据层的**实现级设计**，便于拆分任务与评审。**已落地的 P0 变更见 [ADMIN_MODULE_CHANGELOG.md](./ADMIN_MODULE_CHANGELOG.md)。**

---

## 1. 设计目标与范围

| 项 | 说明 |
|----|------|
| 目标 | 在不大改现有用户站行为的前提下，增加 **`/admin/**` API** 与**独立管理端前端**，满足需求文档中的 MVP（登录、用户/任务/文件只读与约定写操作）。 |
| JWT | Access Token 增加 **`aud`**（`user` \| `admin`），与 **需求 §9** 一致。 |
| Refresh | `refresh_tokens` 增加 **`audience`**（或等价字段），**用户 refresh 与管理员 refresh 分轨**，禁止交叉换发。 |

**非目标（首期）**：子域部署、独立 `JWT_SECRET`（可按 env 二期再加）。

---

## 2. 后端总体结构

### 2.1 新增 Nest 模块（建议）

```
src/admin/
  admin.module.ts
  admin-auth.controller.ts      # POST /admin/auth/login|refresh|logout
  admin-auth.service.ts        # 调用 Prisma + JwtService，签 aud=admin
  admin-users.controller.ts     # GET/PATCH /admin/users
  admin-users.service.ts
  admin-tasks.controller.ts     # GET/DELETE /admin/tasks（MVP 无 PATCH）
  admin-tasks.service.ts        # 委派 TasksService / 或扩展参数
  admin-media.controller.ts     # GET /admin/users/:id/media-files 等（按需求拆分）
  dto/
  guards/
    admin-jwt.guard.ts          # 可选：封装 JwtAuthGuard + aud/admin 校验
  decorators/ ...
```

- **`AdminModule`** 依赖：`AuthModule`（JwtModule）、`PrismaModule`、`TasksModule`（导出 `TasksService`）、`MediaModule`（若需复用）等。
- 路由前缀：在 `AdminModule` 使用 **`@Controller('admin')`**，子路径分别为 `auth`、`users`、`tasks`……与 [ADMIN_MODULE §9](./ADMIN_MODULE.md) 一致。

### 2.2 JWT 载荷（Access）

在现有 `JwtAccessPayload` 上扩展（**Breaking：所有新签发 access 均带 `aud`**）：

```ts
export type JwtAccessPayload = {
  sub: string;
  email: string;
  role: string;
  aud: 'user' | 'admin';
};
```

- **`buildAuthResponse`（用户站）**：`jwt.signAsync({ ...payload, aud: 'user' })`。
- **管理员登录**：仅当 `user.role === UserRole.admin` 时签发 **`aud: 'admin'`**；否则 **401 + 与用户登录相同的泛化文案**（需求 A-02）。

`JwtStrategy.validate` 将 `aud` 传入 `req.user`（或 `AuthUser` 类型扩展），供后续 Guard 使用。

### 2.3 Audience Guard（用户站 API 拒绝 admin token）

**推荐**：新增全局或按需挂载的 **`UserAudienceGuard`**

- 在 **用户业务** Controller 类上增加（或默认绑定列表）：
  - `TasksModule` / `TasksController`
  - `SubscriptionsController`
  - `SettingsController`
  - `MediaController` 中带 `AuthGuard('jwt')` 的方法（或通过类级守卫封装一层）
  - `UrlExtractController` 中 `parse`、`sample`

逻辑：在 `JwtAuthGuard` 通过后，若 **`request.user.aud === 'admin'`** → **`ForbiddenException`**（403）。

**注意**：`AuthController`（`/auth/*`）**不**挂该 Guard；`AdminAuthController` **不**走用户站 Guard。

### 2.4 管理员路由守卫

对 `/admin/**`（除 `auth/login`）：

顺序建议：`JwtAuthGuard` → 校验 **`aud === 'admin'`** → 校验 **`role === admin`**（双保险，防 `aud` 伪造时仍需角色一致）。

可封装为单一 **`AdminAuthGuard`**。

### 2.5 Refresh：数据模型与行为

**Prisma `RefreshToken` 扩展**（三文件 schema 同步 + migration）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `audience` | enum：`user` \| `admin` | 默认 `user`；迁移时现有行回填 `user` |

**签发**：

- 用户站 `buildAuthResponse`：`create({ ..., audience: 'user' })`。
- 管理员登录新接口：同样 `create`，**`audience: 'admin'`**；access `aud: 'admin'`。

**刷新 / 登出**：

- **`POST /auth/refresh`**：`findUnique` 后若 `row.audience !== 'user'` → **401**。
- **`POST /admin/auth/refresh`**：若 `row.audience !== 'admin'` → **401**。

轮换策略与现网一致：refresh **单次使用**后删除旧行再建新行（与当前 `AuthService.refresh` 行为对齐）。

### 2.6 管理员登录接口（行为）

- **`POST /admin/auth/login`**  
  - Body：可与用户登录复用 **`LoginDto`**（邮箱+密码+验证码），或独立 DTO 但字段一致以保持体验。  
  - 校验验证码与密码成功后，若 `user.role !== admin` → **401**，文案与用户登录失败一致（需求 A-02）。  
  - 成功 → `buildAdminAuthResponse(user)`：仅签发 `aud: admin` 的 access + `audience: admin` 的 refresh。

**Captcha**：复用 `CaptchaService`，注意**限流**单独记在 `admin/auth/login`（需求 A-07）。

### 2.7 业务服务复用（用户 / 任务 / 媒体）

| 能力 | 建议 |
|------|------|
| 用户列表/详情/聚合 | 新建 `AdminUsersService` 用 Prisma 查询；**批量聚合**文件 count/sum 见需求 NF-02。 |
| 任务只读/删除 | **删除**调用现有 **`TasksService.remove(userId, id)`**，其中 `userId` 取任务所属用户（管理员身份不传用户 JWT，服务层增加 **admin 上下文**或 **`removeAsAdmin(id)`** 包装，内部校验任务存在即可）。 |
| 任务列表/详情 | 新建查询方法或 `TasksService.listForAdmin(query)`，**禁止**把管理员 `userId` 当普通用户 id 传入现有 `list(userId)`  unless 显式按 `userId` 筛选。 |
| 文件列表 | Prisma `mediaFile.findMany({ where: { userId } })` 或封装在 `MediaService` | 

**原则**：管理端**不写第二套删除任务/队列逻辑**；与 [ADMIN_MODULE T-05](./ADMIN_MODULE.md) 一致。

### 2.8 PATCH `/admin/users/:id`

- 白名单见需求 **§9.2**：仅 `role`、`storageQuotaBytes`、`monthlyDownloadQuotaBytes`。  
- 使用 **class-validator** `PickType` / 显式 DTO，禁止额外字段。  
- **最后一个 admin**：删除/降级前查询 `count({ where: { role: admin } })`。

### 2.9 审计（NF-01）

最小实现：**新表 `admin_audit_logs`**（或命名 `audit_logs` + `actor_role`）：

| 字段 | 说明 |
|------|------|
| id, createdAt | |
| actorUserId | 管理员用户 id |
| action | 枚举或短字符串：`USER_PATCH`、`TASK_DELETE`、`ADMIN_LOGIN` 等 |
| targetType / targetId | 可选 |
| ip | 可选，需 `trust proxy` |

登录成功、PATCH 用户、DELETE 任务写入。**查询接口可作为二期**。

---

## 3. 前端总体结构

### 3.1 路由（Vue Router）

| 路径 | 说明 |
|------|------|
| `/admin` | **空白占位**（不向登录页重定向，避免暴露真实入口） |
| `/admin/<yyyymmdd>/login` | 独立登录页；`meta: { adminGuest: true }`；**仅当**路径中年月日等于当天才可访问，否则前端 **`/`** |
| `/admin/<yyyymmdd>` | `AdminLayout`；`meta: { requiresAdminAuth: true }`；同上，日期须为当天 |
| `/admin/users` | 用户列表 |
| `/admin/users/:id` | 用户详情 + 跳转任务/文件 |
| `/admin/tasks` | 任务列表（query userId） |
| `/admin/tasks/:id` | 任务详情 |

`beforeEach`：

- 访问 `requiresAdminAuth` 且无 **`adminAccessToken`**（或约定 key）→ **`/admin/<today>/login`**（见 `src/utils/adminEntry.ts`）。
- `adminGuest` 且已持有有效 admin token → 可重定向 **`/admin/<today>/home`**。

### 3.2 HTTP 客户端

- 新建 **`src/api/adminClient.ts`**（axios 实例）：`baseURL` 与现 `api` 相同；**请求头**只带 **管理员 access**（localStorage 键如 `adminAccessToken`）。
- **禁止**与共用 `accessToken`，避免 A-05 混用。
- **刷新**：`POST /admin/auth/refresh`，body 使用 `adminRefreshToken`；失败后清 admin 键并跳转 **`/admin/<today>/login`**。

### 3.3 状态

可选 **`useAdminAuthStore`**：`adminUser`、`login`、`logout`、`refresh`），与 `auth` store 分离。

---

## 4. 数据库与迁移清单

1. **`refresh_tokens.audience`**：`user` \| `admin`，默认 `user`，迁移回填。  
2. **（可选首期）`admin_audit_logs`**：与 §2.9 一致。  

同步更新 **`prisma/schema.prisma`**（MySQL）及 **`npm run prisma:sync`** / **`npm run prisma:generate`** 流程（以仓库脚本为准）。

---

## 5. 实现阶段建议（供排期）

| 阶段 | 内容 |
|------|------|
| **P0** | JWT `aud` + 用户站全量改签发；`RefreshToken.audience` + `AuthService` 读写；`UserAudienceGuard`；回归用户站登录/刷新。 |
| **P1** | `POST /admin/auth/login|refresh|logout` + 前端 `/admin/<today>/login` + admin axios。 |
| **P2** | `GET/PATCH /admin/users`、聚合字段；验收 U-04 超额告警 UI。 |
| **P3** | `GET/DELETE /admin/tasks`、用户穿透任务列表；复用删除逻辑。 |
| **P4** | `GET /admin/.../media-files`、文件详情；可选 T-08。 |
| **P5** | 审计表与写入；E2E/集成测试清单对照 **ADMIN_MODULE §10**。 |

---

## 6. 测试要点（摘要）

- 用户 access → 任意 `GET /admin/users` → **403**。  
- admin access → `GET /tasks` → **403**。  
- 用户 refresh → `POST /admin/auth/refresh` → **401**。  
- 管理员 refresh → `POST /auth/refresh` → **401**。  
- 迁移后旧 refresh（均为 user）行为与现网一致。

---

## 7. 文档关系

| 文档 | 角色 |
|------|------|
| [ADMIN_MODULE.md](./ADMIN_MODULE.md) | 需求与 MVP/二期边界 |
| **本文档** | 实现拆解与模块边界 |
| 后续可增 `ADMIN_MODULE_API.md` | OpenAPI 出码后再补 |

---

## 8. 修订记录

| 版本 | 说明 |
|------|------|
| 0.1 | 初稿：模块划分、JWT/Refresh、Guard、前后端拆分、迁移与阶段 |

---

*开发中若调整策略（例如双 `JwtStrategy`），请更新 §2 并保留一节「已废弃方案」以便复盘。*
