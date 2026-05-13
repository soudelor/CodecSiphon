/**
 * 本地诊断：模拟链接解析管线中的「规范化 + yt-dlp -J」。
 * 用法（在 backend 目录）：npm run probe:url-extract -- "https://..."
 *
 * 会读取 backend/.env（未覆盖已存在的环境变量）。抖音常见失败原因见控制台 stderr
 * （如 Fresh cookies are needed → 配置 YTDLP_COOKIES_FILE）。
 *
 * normalizeDouyin* 逻辑需与 src/url-extract/sites/douyin-shared.ts 保持同步。
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile() {
  const p = resolve(__dirname, '../.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function ytDlpBin() {
  return (
    process.env.YTDLP_PATH?.trim() ||
    (process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
  );
}

function isDouyinHost(host) {
  const h = host.toLowerCase();
  return h === 'www.douyin.com' || h === 'douyin.com' || h === 'm.douyin.com';
}

/** @param {string} url */
function normalizeDouyinExtractUrl(url) {
  const raw = url.trim();
  let u;
  try {
    u = new URL(raw);
  } catch {
    return raw;
  }
  if (!isDouyinHost(u.hostname)) return raw;
  let path = u.pathname || '/';
  path = path.replace(/\/+$/, '') || '/';
  const modalId = u.searchParams.get('modal_id')?.trim();
  if (!modalId || !/^\d+$/.test(modalId)) return raw;
  const lower = path.toLowerCase();
  if (lower === '/jingxuan' || lower.startsWith('/jingxuan/')) {
    return `${u.origin}/video/${modalId}`;
  }
  return raw;
}

/** @param {string} extractUrl */
function useFlatPlaylist(extractUrl) {
  try {
    const u = new URL(extractUrl.trim());
    const p = `${(u.pathname || '/').replace(/\/+$/, '')}/`.toLowerCase();
    if (p.startsWith('/video/')) return false;
  } catch {
    /* ignore */
  }
  return true;
}

function buildArgs(extractUrl) {
  const args = ['-J', '--skip-download', '--no-warnings'];
  const ua = process.env.YTDLP_USER_AGENT?.trim();
  if (ua) args.push('--user-agent', ua);
  const ref = process.env.YTDLP_REFERER?.trim();
  if (ref) args.push('--add-header', `Referer:${ref}`);
  const cf = process.env.YTDLP_COOKIES_FILE?.trim();
  if (cf) {
    if (!existsSync(cf)) {
      console.error(`[probe] YTDLP_COOKIES_FILE 不存在: ${cf}`);
    } else {
      args.push('--cookies', cf);
    }
  }
  const cfb = process.env.YTDLP_COOKIES_FROM_BROWSER?.trim();
  if (cfb) args.push('--cookies-from-browser', cfb);
  if (useFlatPlaylist(extractUrl)) args.push('--flat-playlist');
  args.push(extractUrl);
  return args;
}

loadEnvFile();

const raw = process.argv[2];
if (!raw?.trim()) {
  console.error(
    '用法: npm run probe:url-extract -- "https://www.douyin.com/jingxuan?modal_id=..."',
  );
  process.exit(1);
}

const extractUrl = normalizeDouyinExtractUrl(raw);
const bin = ytDlpBin();

console.log('[probe] 输入 URL:', raw.trim());
if (extractUrl !== raw.trim()) {
  console.log('[probe] 规范化后（与 API 内 dump 一致）:', extractUrl);
}
console.log('[probe] yt-dlp:', bin);
const cf = process.env.YTDLP_COOKIES_FILE?.trim();
if (cf) {
  console.log(
    '[probe] Cookie 文件:',
    existsSync(cf) ? `已找到 (${cf})` : `缺失 (${cf})`,
  );
} else {
  console.log('[probe] YTDLP_COOKIES_FILE: 未设置（抖音多数情况下会失败）');
}

const args = buildArgs(extractUrl);
console.log('[probe] 参数:', args.join(' '));

const r = spawnSync(bin, args, {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  windowsHide: true,
});

const out = (r.stdout || '').trim();
const err = (r.stderr || '').trim();

if (err) {
  console.error('[probe] stderr:\n', err.slice(0, 4000));
}

if (r.status !== 0) {
  console.error('[probe] 退出码:', r.status ?? r.signal);
  process.exit(r.status ?? 1);
}

if (!out || out === 'null') {
  console.error(
    '[probe] stdout 为空或 JSON null → 与线上「需要 Cookie / 地区限制」表现一致，请配置 YTDLP_COOKIES_FILE 后重试。',
  );
  process.exit(2);
}

try {
  const j = JSON.parse(out);
  const t = j && typeof j === 'object' ? j._type ?? '(无 _type)' : typeof j;
  const n = Array.isArray(j?.entries) ? j.entries.length : null;
  console.log('[probe] JSON 根类型 _type:', t, n != null ? `entries: ${n}` : '');
  console.log('[probe] 摘要 OK（如需完整 JSON 可自行重定向 stdout）');
} catch {
  console.error('[probe] JSON 解析失败，stdout 开头:', out.slice(0, 500));
  process.exit(3);
}
