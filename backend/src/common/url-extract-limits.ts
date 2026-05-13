import { ConfigService } from '@nestjs/config';

const DEFAULT_MAX = 100;
const MAX_CAP = 500;
const DEFAULT_PUBLIC_PREVIEW = 3;
/** 公开接口：滑动窗口内最大请求数 */
const DEFAULT_PUBLIC_RATE_LIMIT = 20;
/** 滑动窗口时长（毫秒），默认 15 分钟 */
const DEFAULT_PUBLIC_RATE_WINDOW_MS = 15 * 60 * 1000;

/** 登录用户「节选下载」片长（秒）：默认 30，下限 5，上限 120 */
const DEFAULT_SAMPLE_MAX_SEC = 30;
const SAMPLE_MAX_SEC_CAP = 120;
const SAMPLE_MAX_SEC_MIN = 5;

export function getUrlExtractMaxItems(config: ConfigService): number {
  const raw = config.get<string | undefined>('URL_EXTRACT_MAX_ITEMS');
  if (raw === undefined || raw === '') return DEFAULT_MAX;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MAX;
  return Math.min(Math.floor(n), MAX_CAP);
}

export function getUrlExtractPublicPreviewCount(config: ConfigService): number {
  const raw = config.get<string | undefined>('URL_EXTRACT_PUBLIC_PREVIEW');
  if (raw === undefined || raw === '') return DEFAULT_PUBLIC_PREVIEW;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_PUBLIC_PREVIEW;
  return Math.min(Math.floor(n), 50);
}

export function getUrlExtractPublicRateLimit(config: ConfigService): {
  limit: number;
  windowMs: number;
} {
  const raw = config.get<string | undefined>('URL_EXTRACT_PUBLIC_RATE_LIMIT');
  let limit = DEFAULT_PUBLIC_RATE_LIMIT;
  if (raw !== undefined && raw !== '') {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 1) limit = Math.min(n, 1000);
  }
  const rawWin = config.get<string | undefined>(
    'URL_EXTRACT_PUBLIC_RATE_WINDOW_MS',
  );
  let windowMs = DEFAULT_PUBLIC_RATE_WINDOW_MS;
  if (rawWin !== undefined && rawWin !== '') {
    const n = parseInt(rawWin, 10);
    if (Number.isFinite(n) && n >= 60_000) windowMs = Math.min(n, 3600_000);
  }
  return { limit, windowMs };
}

export function getUrlExtractSampleMaxSec(config: ConfigService): number {
  const raw = config.get<string | undefined>('URL_EXTRACT_SAMPLE_MAX_SEC');
  if (raw === undefined || raw === '') return DEFAULT_SAMPLE_MAX_SEC;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return DEFAULT_SAMPLE_MAX_SEC;
  return Math.min(
    SAMPLE_MAX_SEC_CAP,
    Math.max(SAMPLE_MAX_SEC_MIN, Math.floor(n)),
  );
}

export class UrlExtractPublicRateLimiter {
  private readonly buckets = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /**
   * @returns true 若允许请求
   */
  tryConsume(key: string): boolean {
    const now = Date.now();
    const prev = this.buckets.get(key) ?? [];
    const windowStart = now - this.windowMs;
    const next = prev.filter((t) => t > windowStart);
    if (next.length >= this.limit) {
      this.buckets.set(key, next);
      return false;
    }
    next.push(now);
    this.buckets.set(key, next);
    return true;
  }
}
