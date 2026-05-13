import { BadRequestException } from '@nestjs/common';

export function isDouyinHostname(host: string): boolean {
  const h = host.toLowerCase();
  return h === 'www.douyin.com' || h === 'douyin.com' || h === 'm.douyin.com';
}

const LISTABLE_PATH_PREFIXES = [
  '/video/',
  '/note/',
  '/user/',
  '/collection/',
  '/series/',
  '/live/',
];

/**
 * 精选页 `/jingxuan?modal_id=` 等：将 `modal_id` 规范化为标准视频页 `/video/{id}`，便于通过前置校验与 yt-dlp。
 * 无法识别或非抖音域名时返回原始 trim 后字符串。
 */
export function normalizeDouyinExtractUrl(url: string): string {
  const raw = url.trim();
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw;
  }
  if (!isDouyinHostname(u.hostname)) {
    return raw;
  }

  let path = u.pathname || '/';
  path = path.replace(/\/+$/, '') || '/';
  const modalId = u.searchParams.get('modal_id')?.trim();
  if (!modalId || !/^\d+$/.test(modalId)) {
    return raw;
  }

  const lower = path.toLowerCase();
  if (lower === '/jingxuan' || lower.startsWith('/jingxuan/')) {
    return `${u.origin}/video/${modalId}`;
  }
  return raw;
}

/**
 * 抖音首页、推荐流（路径为 `/`）或无可解析前缀的路径：在拉 yt-dlp 前拒绝并返回明确 i18n key。
 */
export function assertDouyinExtractableUrl(url: string): void {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return;
  }
  if (!isDouyinHostname(u.hostname)) {
    return;
  }

  let path = u.pathname || '/';
  path = path.replace(/\/+$/, '') || '/';

  if (path === '/') {
    throw new BadRequestException({ key: 'errors.urlExtractDouyinHomeFeed' });
  }

  const lower = `${path}/`.toLowerCase();
  const ok = LISTABLE_PATH_PREFIXES.some((p) => lower.startsWith(p));
  if (!ok) {
    throw new BadRequestException({
      key: 'errors.urlExtractDouyinNeedDeepLink',
    });
  }
}
