# 管理员模块 — 功能清单与说明

**技术实现设计见：[ADMIN_MODULE_TECH_DESIGN.md](./ADMIN_MODULE_TECH_DESIGN.md)。**  
**代码变更回溯见：[ADMIN_MODULE_CHANGELOG.md](./ADMIN_MODULE_CHANGELOG.md)。**

本文档描述 CodecSiphon **独立管理后台**的目标范围、功能清单与非功能要求，供评审与排期。实现时可据此拆解迭代（MVP / 二期）。

---

## 1. 文档目的与术语

| 术语 | 含义 |
|------|------|
| **管理端** | 仅 `User.role = admin` 可使用的 Web 界面与后端 API，与普通用户工作台隔离 |
| **用户站** | 现有前台：登录 `/login`、任务/文件等业务 |
| **独立管理员登录** | 管理端使用 **独立登录页与独立认证接口**，签发的访问令牌与普通用户令牌在策略上区分（见 3） |

---

## 2. 目标与边界

### 2.1 目标

- 平台运营方能够**集中管理注册用户**及其**下载任务**（跨用户查询与约定范围内的操作）。
- 管理入口与凭证体系与**普通用户前台明确分离**，降低误用与横向风险。

### 2.2 本期建议范围（MVP）

- 独立 `/admin/login` + 后端 `POST /admin/auth/login`（及 **仅管理员范围** 的刷新/退出，见 **A-06**）。
- 用户列表/详情（只读或可写项见功能表）。
- **下载任务（跨用户）**：**只读**（列表、多维筛选、详情）+ **删除**（**T-05**）；**首期不包含**管理员侧取消 / 暂停 / 恢复（**T-04** 见 §2.4）。
- **按用户汇总**：每位用户下载入库的**文件总条数**、**文件占用总字节**；并可从用户穿透查看其**任务明细**与**文件明细**。

### 2.3 本期不做（可标为二期）

- 管理员在后台对任务的 **取消 / 暂停 / 恢复**（**T-04**，与 MVP 边界见 §2.4）。
- 代用户登录（Impersonation）、代下视频。
- 细粒度运营子角色（如只读 Support），除非单独立项。
- 全站运行时配置中心（仍优先环境变量 / 现有配置方式）。

### 2.4 已定稿产品决策（实现须遵守）

| 决策点 | 结论 |
|--------|------|
| **A-05** | **管理员 access 令牌禁止调用用户站业务 API**（如 `/tasks`、`/media/*` 等）；用户站令牌亦不得访问 `/admin/**`。后端对错误 audience 一律 **403**。 |
| **A-06** | **管理员 refresh 与用户 refresh 不得混用**：分开发放、分表或带 **不同 `aud` / `token_type`**；**禁止**用用户 refresh 换管理员 access 或反过来；前端分键存储（如 `adminRefreshToken` / `accessToken`）。 |
| **U-04** | 调整 **存储配额**时 **允许**将 `storageQuotaBytes` 设为**低于**当前 `storageUsedBytes`（**不因「已超额」拒绝保存**）；管理端须展示**超额告警**（已用量超过新配额）。 |
| **任务首期范围** | 任务侧 **只读 + 删除**（**T-05**）；**不含 T-04**。 |

---

## 3. 独立管理员登录（认证策略）

| 编号 | 功能 | 描述 |
|------|------|------|
| **A-01** | 管理端登录页 | 独立路由（如 `/admin/login`），布局与文案与用户站登录页区分，不嵌入用户 `MainLayout`。 |
| **A-02** | 管理员登录接口 | 如 `POST /admin/auth/login`：校验邮箱+密码（与现有密码体系一致）；**仅当** `role === admin` 时签发令牌；否则返回**与“账号或密码错误”类同的泛化错误**，避免枚举管理员账号。 |
| **A-03** | 管理员访问令牌 | JWT 须含 `role: admin` 与 **`aud: admin`**（或等价 scope），供 Guard 与用户站 API 区分。 |
| **A-04** | 管理端路由守卫 | 访问 `/admin/*`（除登录页）无有效管理员令牌 → 跳转 `/admin/login`。 |
| **A-05** | 用户站与令牌隔离（强制） | 同 **§2.4**：用户站 access **不得** 访问 `/admin/**`；管理员 access **不得** 访问用户站受保护 API；Guard **403**。同一人兼任管理员与普通用户时，须**分会话**（如双浏览器/无痕或分站存储），避免单页混用两套 token。 |
| **A-06** | 刷新与退出（正交） | 同 **§2.4**：`/admin/auth/refresh` 与 `/admin/auth/logout` 仅服务管理员 refresh；与用户站 refresh **分表或分 `aud`/类型**；前端 **分键**（如 `adminAccessToken` / `adminRefreshToken`）。 |
| **A-07** | 限流与安全 | `/admin/auth/login` 单独限流（可严于用户登录）；生产环境管理端强制 HTTPS；登录成功建议记审计（见 NF-01）。 |

---

## 4. 用户管理

| 编号 | 功能 | 描述 |
|------|------|------|
| **U-01** | 用户分页列表 | 分页展示用户：邮箱、显示名、`role`、存储已用/配额、`createdAt` 等；支持按邮箱模糊、注册时间、`role` 筛选。**建议增加列**：该用户入库的 **下载文件条数**、**文件总大小（字节）**（口径见 **U-06**）。 |
| **U-02** | 用户详情 | 展示单用户完整基础信息与用量；展示统计：**任务总数**、进行中/失败数（可选）；**下载文件条数**与 **文件总大小**（与 **U-06** 口径一致）；提供入口跳转「该用户任务列表」「该用户文件列表」（见 **T-07**、**F-01**）。 |
| **U-03** | 修改角色 | `PATCH`：在 `user` / `admin` 间切换；**必须**防止删除最后一个管理员（例如禁止降级最后一个 `admin` 或禁止删除）。 |
| **U-04** | 调整存储配额 | `PATCH`：`storageQuotaBytes`。**已定稿**：允许保存为**低于**当前已用量的值（**超额不禁改**）；管理端须明显提示**超额告警**（见 **§2.4**）。**用户站**侧对「超配额是否禁止新建任务」等保持**现有业务逻辑**；与管理员调配额无强一致要求，投诉排障时需区分两端规则。 |
| **U-05** | 账号禁用（可选） | 若本期要做：模型增加 `isActive` / `disabledAt`，登录时拒绝；列表展示状态。不做则仅通过角色与人工流程约束。 |
| **U-06** | 文件汇总口径 | 「文件」指 **`media_files` 表中 `user_id = 该用户` 的记录**。指标：**文件总数** = `COUNT(*)`；**文件总大小** = `SUM(size_bytes)`。应与业务上 **`users.storage_used_bytes`** 可对账（原则上同源；若历史上存在手工调整用量，需在详情页注明「库表聚合 vs 账户字段」差异）。 |

---

## 5. 下载任务管理（跨用户）

| 编号 | 功能 | 描述 |
|------|------|------|
| **T-01** | 任务分页列表 | 跨用户分页列表；字段与用户任务列表对齐的核心列：`status`、`progress`、`title`、`source`、`createdAt`、`userId`/邮箱等。 |
| **T-02** | 多维筛选 | 支持按 `userId`、用户邮箱、`status`、`sourceType`、创建时间范围、标题/摘要关键词（能力与索引需在实现时限定，避免全表扫描）。 |
| **T-03** | 任务详情 | 只读展示任务摘要、错误码/错误信息、进度、关联用户标识；**不**展示用户 Cookie、密码等敏感字段。 |
| **T-04** | 取消 / 暂停 / 恢复 | **二期**：与用户自助语义一致，须调用**现有任务领域服务**，同步队列（Bull）、磁盘目录规则一致；管理员身份在服务层显式校验。**MVP 不包含**（首期仅只读 + 删除，见 **§2.2 / §2.4**）。 |
| **T-05** | 删除任务 | 与用户删除语义一致：移除队列作业、删除下载目录及相关 `media_files` 等（复用现有 `remove` 路径），禁止维护两套删除逻辑。 |
| **T-06** | 禁止项 | 不提供随意篡改 `progressPercent`「粉饰进度」；不提供绕过队列直接改库完成任务（除非单列运维脚本需求）。 |
| **T-07** | 某用户的任务明细 | 在指定 `userId` 下的分页任务列表（字段与 **T-01** 一致，隐含筛选 `user_id`）；可从用户详情一键打开；支持与全局任务列表共用同一查询接口（`GET /admin/tasks?userId=`）。 |
| **T-08** | 任务关联文件（可选增强） | 在任务详情页列出该任务产生的 **`media_files`**（文件名、大小、`relative_path` 摘要、`created_at`），便于管理员核对「任务 → 产物」而不必跳到文件列表再筛选。 |

---

## 6. 下载文件（媒体库）— 跨用户查询

面向管理员查看「用户下载落到库里的文件」明细（对应模型 **`MediaFile`** / `media_files`）。

| 编号 | 功能 | 描述 |
|------|------|------|
| **F-01** | 指定用户的文件分页列表 | 分页列出某 `userId` 下所有入库文件：`file_name`、`size_bytes`、`mime_type`、`task_id`（若有）、`created_at`、`relative_path`（或脱敏展示）；支持按文件名关键词、`task_id`、创建时间范围筛选。 |
| **F-02** | 文件详情 | 单条文件只读详情：同上字段 + `checksum_sha256`（若有）、分辨率/时长等 `metadata` 摘要（若有）；**不**返回可直接构造任意用户下载链接的临时令牌（若需下载审计需单列流程）。 |
| **F-03** | 删除文件（可选） | 若开放：与用户站删除语义一致（删库记录 + 删磁盘对象 + 回退 `storage_used_bytes`），须复用统一领域服务并记审计；本期可不开放，仅以任务删除级联清理为主。 |

---

## 7. 管理端界面与导航

| 编号 | 功能 | 描述 |
|------|------|------|
| **N-01** | 管理端壳 | 独立侧栏/顶栏；包含「用户管理」「任务管理」；可按入口聚合「全局文件浏览」（可选）或通过用户详情穿透 **F-01**；语言（若需要）、退出登录等。 |
| **N-02** | 与用户站隔离 | 用户站导航**不**出现管理入口（或仅 `admin` 可见小链接，产品定）；默认推荐完全不在用户站暴露 URL。 |
| **N-03** | 错误与权限 | 非 `admin` 访问管理 API 返回 **403**；前端展示统一无权限页。 |

---

## 8. 非功能需求

| 编号 | 类别 | 描述 |
|------|------|------|
| **NF-01** | 审计日志 | 对管理端写操作（改角色、配额、删任务等）记录：`actor`（管理员 id）、动作、目标类型与 id、时间、可选 IP；**登录成功**建议记录一条。 |
| **NF-02** | 性能 | 列表必须分页；查询条件与 Prisma/DB 索引对齐（如 `download_tasks(user_id, created_at)`、`media_files(user_id, created_at)`）。用户列表若展示聚合列，优先单次查询 **JOIN 子查询 / 分组聚合** 或单独批量接口，避免 N+1。 |
| **NF-03** | 首个管理员 | 文档化：通过迁移种子、一次性脚本或手工更新 `users.role`，保证系统可初始化出至少一名 `admin`。 |
| **NF-04** | Refresh 区分与迁移 | 为用户/管理员 refresh 引入 `aud` 或 `token_type` 时须有 **Prisma 迁移**、回填或失效策略及部署说明（见 **§9.4**），避免线上新旧 token 语义不清。 |

---

## 9. 后端 API 形态（草案，实现时以代码为准）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/admin/auth/login` | 管理员登录，返回管理员范围 access（+ refresh 若采用） |
| POST | `/admin/auth/refresh` | **仅**接受管理员 refresh（`aud: admin` / 独立 token_type），**不得**与用户 refresh 混用（见 **§2.4**） |
| POST | `/admin/auth/logout` | 失效**管理员** refresh；与用户站 logout 数据隔离 |
| GET | `/admin/users` | 用户列表（query：分页、筛选） |
| GET | `/admin/users/:id` | 用户详情（含聚合：任务计数、文件条数与总大小等，字段见 U-02/U-06） |
| PATCH | `/admin/users/:id` | 仅 **§9.2** 白名单字段（MVP：`role`、`storageQuotaBytes`、`monthlyDownloadQuotaBytes`） |
| GET | `/admin/users/:id/tasks` | 可选独立路由；语义等同 `GET /admin/tasks?userId=:id`（见 T-07） |
| GET | `/admin/users/:id/media-files` | 该用户入库文件分页列表（见 F-01） |
| GET | `/admin/media-files/:id` | 单条文件详情（见 F-02） |
| DELETE | `/admin/media-files/:id` | 可选（见 F-03） |
| GET | `/admin/tasks` | 跨用户任务列表（query：`userId`、分页、其余筛选同 T-02） |
| GET | `/admin/tasks/:id` | 任务详情 |
| PATCH | `/admin/tasks/:id` | **二期**（**T-04**）；MVP **不提供** |
| DELETE | `/admin/tasks/:id` | **MVP**：删除任务，语义同用户删除（**T-05**） |

所有 `/admin/**`（除登录/刷新若需匿名）均需 **JWT + `admin` + `aud: admin`（或等价）**。

**用户站 API**：携带管理员令牌访问 **§9.1** 所列须用户 access 的路由 → **403**（见 **A-05 / §2.4**）。

### 9.1 用户站：须「用户 access」（非 admin audience）的接口

实现目标：凡是**当前已用 `AuthGuard('jwt')`、且意为「登录用户自用」**的接口，在校验 JWT 后若 **`aud` 为 admin**（或等价），返回 **403**。下列以 **现行 Nest 控制器**为锚；若后续增删路由，发布前请同步更新本表。

**须用户 access（Bearer），禁止管理员 access：**

| 范围 | 说明 |
|------|------|
| **`/tasks` 及子路径** | 含 `GET/POST/PATCH/DELETE`、`POST /tasks/preview` 等（`tasks.controller` 类级 JWT） |
| **`/subscriptions` 及子路径** | 类级 JWT |
| **`/settings`** | 类级 JWT |
| **`/media`（部分）** | 须 JWT：`GET /media`、`POST /media/:id/download-link`、`GET /media/:id/download`、`DELETE /media/:id` |
| **`POST /url-extract/parse`**、**`POST /url-extract/sample`** | 须 JWT |

**不要求用户 Bearer、或凭其它凭证的接口**（不按「用户 access」拦截 admin；业务上 admin 亦无权以用户身份写数据）：

| 路径 | 说明 |
|------|------|
| `GET /`、`GET /health` | 健康检查 |
| **`GET /auth/captcha`**、**`POST /auth/login`**、**`POST /auth/register`**、**`POST /auth/send-registration-code`** | 认证入口（含注册邮箱 OTP 发码） |
| **`POST /auth/refresh`**、**`POST /auth/logout`** | 仅处理**用户站 refresh**（见 **§9.3**）；管理员 refresh **不得**调此路径换发 |
| **`POST /url-extract/preview-public`** | 公开预览 |
| **`GET /media/:id/file?dl_token=...`** | 凭短期下载令牌，非 Bearer |

> **注册邮箱验证码**：`POST /auth/send-registration-code` 发码（须图形验证码），`POST /auth/register` 提交 `emailVerificationCode` 核销并注册；SMTP 未配置时发码 503；需求见 [REGISTER_EMAIL_VERIFICATION_REQUIREMENTS.md](./REGISTER_EMAIL_VERIFICATION_REQUIREMENTS.md)。

> 亦可采用全局策略：**凡非白名单路径且带 `Authorization: Bearer`，若 token 为 admin audience 且路由属于「用户业务命名空间」，一律 403**——与上表等价时以实现为准。

### 9.2 `PATCH /admin/users/:id` 字段白名单（MVP）

仅允许下列字段；其余字段传入须 **400** 或直接忽略（产品定一种并写进 API 规范）。

| 字段 | 说明 |
|------|------|
| **`role`** | `user` \| `admin`，遵守 U-03「最后一个 admin」约束 |
| **`storageQuotaBytes`** | 非负整数（字节），遵守 **U-04**（允许低于已用量 + 超额告警） |
| **`monthlyDownloadQuotaBytes`** | 非负整数（字节）；单月出站下载配额上限（用量统计与拦截策略与用户站对齐情况见实现说明） |
| **`isActive`** | **U-05**：布尔；`false` 时禁用登录与用户站 refresh，`true` 时恢复；服务端同步 `disabledAt`。**不得**停用最后一个可用的 `admin`、`不得` 操作者停用自己 |

**禁止**通过本接口修改 `email`、`passwordHash`、`displayName` 等；若未来扩展须升文档版本并补审计。

### 9.3 Refresh 路径对照（防交叉换发）

| 用途 | 方法 | 路径 | Body 约定 |
|------|------|------|-----------|
| 用户站换发 access | POST | **`/auth/refresh`** | `{ "refreshToken": "<用户 refresh>" }` |
| 用户站登出 | POST | **`/auth/logout`** | 同上 |
| 管理端换发 access | POST | **`/admin/auth/refresh`** | `{ "refreshToken": "<管理员 refresh>" }` |
| 管理端登出 | POST | **`/admin/auth/logout`** | 同上 |

持久化层对 refresh 记录须能区分 **user / admin**（`aud` 或 `token_type`）。**禁止**用户 refresh 在 `/admin/auth/refresh` 换发 access，反之亦然 → **401 / 403**。

### 9.4 `refresh_tokens` 表演进（实现提示）

若在 Prisma `refresh_tokens` 上新增 **`aud`** 或 **`token_type`**（`user` | `admin`）：须 **migration** 与上线说明。历史 token 可：**(a)** 一律视为 `user`；或 **(b)** 强登出让用户/管理员重登。避免长期双逻辑无文档并存。

---

## 10. 验收检查项（摘要）

- 普通用户使用用户站令牌请求任意 `/admin/**` → **403**。
- **管理员**携带 **管理员 access** 请求 **§9.1** 中「须用户 access」的接口（如 **`GET /tasks`**、**`GET /media`**）→ **403**（**A-05**）。
- **`POST /admin/auth/refresh`** 传入 **用户站 refresh**（或 **`POST /auth/refresh`** 传入 **管理员 refresh**）→ **401 / 403**，且不得换发错 audience 的 access（**§9.3**）。
- 非 `admin` 账号通过 `/admin/auth/login` → **不**颁发可用管理令牌（或等价失败）。
- `admin` 仅通过管理端登录后可访问管理页面与 `/admin/**` API。
- **MVP**：管理端 **DELETE** 删除任务与用户站行为一致（含队列与文件系统）；**无** `PATCH /admin/tasks/:id` 状态变更。
- 写操作有可查询的审计记录（最低满足 NF-01）；改配额若产生超额须有**可查的告警/UI 提示**（**U-04**）。
- 用户列表或详情展示的「文件条数 / 文件总大小」与 `media_files` 聚合一致；与 `storage_used_bytes` 差异（若有）可查或可查文档说明。

---

## 11. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1 | — | 初稿：功能清单 + 独立管理员登录 + API 草案 |
| 0.2 | — | 增补：用户维度文件总数/总大小、任务与文件明细穿透（U-06、T-07/T-08、F-xx）、API 草案与管理端导航 |
| 0.3 | — | 已定稿：**A-05** 双令牌、**A-06** refresh 正交、**U-04** 配额超额仅告警、MVP 任务 **只读+删除**（T-04 二期），验收与 API 表同步 |
| 0.4 | — | 按评审补充：**§9.1** 用户站 JWT 范围与匿名例外、**§9.2** PATCH 用户白名单、**§9.3–9.4** refresh 路径与表迁移、**NF-04**；**U-04** 与用户站配额逻辑关系说明 |

---

*其余可选项：**U-05**、**T-08**、**F-03** 仍为拍板项；已定稿内容见 **§2.4**。*
