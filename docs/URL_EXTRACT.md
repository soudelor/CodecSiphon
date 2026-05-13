# 链接解析（URL Extract）模块设计

## 目标

- 用户输入页面网址，解析出**视频条目列表**（标题、时长、分辨率、发布时间、`copyUrl` 等）。
- **登录用户**：完整列表（有上限）、每行**单条复制**，不提供「复制全部」。
- **未登录用户**：引流预览页 — **总数统计**、**仅展示前 3 条**（其余省略说明）、每条**可复制 `copyUrl`**；文案引导登录查看完整列表。

## 能力来源

- 复用 **yt-dlp**（与下载/预览相同二进制与 `YTDLP_*` 配置）。
- 列表类链接使用 **`--flat-playlist` + `-J`** 快速拉取条目；单链接视频返回单条。
- `copyUrl` 优先 `webpage_url`，否则 `url` / `original_url`（以 yt-dlp JSON 为准）。

## API

| 接口 | 鉴权 | 说明 |
|------|------|------|
| `POST /url-extract/preview-public` | 无 | 返回 `total`、`previewItems`（≤3，含 `copyUrl`）、`hiddenCount` 等；**IP 限流更严**。 |
| `POST /url-extract/parse` | JWT | 返回完整 `items`（ capped 于 `URL_EXTRACT_MAX_ITEMS`）、`total`、`listTruncated`。 |
| `POST /url-extract/sample` | JWT | 请求体 `{ "videoUrl": "<单行 copyUrl>" }`；从片头截取至多 `URL_EXTRACT_SAMPLE_MAX_SEC` 秒，以附件流返回（yt-dlp `--download-sections`；**需服务器 PATH 含 ffmpeg**）。 |

错误体沿用 `{ key, args? }`，与现有预览错误 i18n 一致。

## 配置（环境变量）

- `URL_EXTRACT_MAX_ITEMS`：登录版单次返回条目上限（默认 100，有绝对上限防止误配）。
- `URL_EXTRACT_PUBLIC_PREVIEW`：公开预览条数（默认 3）。
- `URL_EXTRACT_PUBLIC_RATE_LIMIT`：公开接口每 IP **滑动窗口**内最大请求数（默认 20）。
- `URL_EXTRACT_PUBLIC_RATE_WINDOW_MS`：滑动窗口时长（毫秒，默认 900000 = 15 分钟；最小 60000）。
- `URL_EXTRACT_SAMPLE_MAX_SEC`：登录版「节选下载」最大片长（秒，默认 30，允许 5–120）；服务端需 **ffmpeg** 才能完成截取。
- 与 `YTDLP_PATH`、`YTDLP_USER_AGENT`、`YTDLP_REFERER`、`YTDLP_COOKIES_FILE` 等共用。

## 站点与链接形式（重要）

- **抖音（douyin.com）**：首页、推荐流等路径为 `/` 的入口（例如带 `?recommend=1`）**不是**可解析的列表页，yt-dlp 无法从中得到视频条目；请使用**具体视频页**（URL 中含 `/video/` 等）或**作者主页作品列表**链接。**精选页**形如 `.../jingxuan?modal_id=<数字>` 会在服务端规范化为 `/video/<modal_id>` 再解析。  
  **重要**：抖音接口在 yt-dlp 侧通常要求 **新鲜 Cookie**（不一定登录；错误信息多为 *Fresh cookies … are needed*）。请在 `backend/.env` 配置 **`YTDLP_COOKIES_FILE`**（或 `YTDLP_COOKIES_FROM_BROWSER`，仅适合有浏览器的本机），否则解析会得到 `null` 或失败。  
  **本地自检**（在 `backend/` 下，会先读 `.env`）：`npm run probe:url-extract -- "https://www.douyin.com/jingxuan?modal_id=..."`，根据控制台 stderr 与是否输出合法 JSON 判断环境与 Cookie 是否就绪。

## 后端：按站点类型分发（扩展方式）

解析前会根据 URL **识别站点类型**（如抖音、B 站、YouTube），再交给对应 **站点处理器**；无专门处理器时走**统一路径**（同一套 yt-dlp dump + `mapYtDlpJsonToExtractList`）。

- **识别**：`backend/src/url-extract/sites/detect-site.ts`（`detectUrlExtractSite`）。
- **分发**：`backend/src/url-extract/sites/resolve-site-handler.ts`（`resolveUrlExtractSiteHandler`）。
- **处理器契约**：`backend/src/url-extract/sites/site-handler.ts`（`UrlExtractSiteHandler`：可选 `resolveExtractUrl`、`preExtract`、`getYtDlpDumpOverrides`）。
- **接入服务**：`UrlExtractService` 在公开预览与登录完整解析中均：`resolve` → 计算 `extractUrl`（`resolveExtractUrl` 或原 URL）→ `preExtract` → `dumpForExtract(extractUrl, site)`。

新增某站点特化逻辑时：增加检测分支（或独立模块）、实现 `UrlExtractSiteHandler` 并在 `resolveUrlExtractSiteHandler` 中注册；仅需改 yt-dlp 参数的站点可实现 `getYtDlpDumpOverrides`；仅需规范化入口 URL 的可实现 `resolveExtractUrl`，无需复制整段 dump 流程。

## 前端

- **公开路由**（无需登录）：`/tools/url-extract`，轻量顶栏 + 预览表单与结果 + 登录/注册 CTA；可选 `?url=` 预填。
- **可选演示短视频**：构建时设置 `VITE_URL_EXTRACT_DEMO_VIDEO`（见 `frontend/.env.example`）可在预览页标题下展示一段视频；支持 **mp4/webm 等直链**、**站内 `public/` 相对路径**（如 `/demo.mp4`），或 **YouTube 观看页/短链**（嵌入 iframe）。**不包含**对解析结果中抖音/B 站页面的内嵌播放（受站点策略与版权限制，解析结果仍以可复制链接为准）。
- **站内路由**（需登录）：`/url-extract`，主导航入口；完整表格 + 单行复制 + **节选下载**（调用 `POST /url-extract/sample`，片长由 `URL_EXTRACT_SAMPLE_MAX_SEC` 约束）；可带 `?url=` 从预览页跳入。

## 风控

- 公开接口限流（IP；`TRUST_PROXY=1` 时依赖反向代理正确设置 `X-Forwarded-For`）。
-  stdout 体积沿用 `ytdlp.dump` 上限；超大输出返回既有 `previewMetadataTooLarge` 类错误。

## 非目标（首版）

- 批量复制、导出文件。
- 保证所有站点均有分辨率/发布时间（字段缺省时 UI 显示「—」）。
