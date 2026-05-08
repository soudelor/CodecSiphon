import { ConfigService } from '@nestjs/config';

const DEFAULT_MULTI_URL_MAX = 5;
/** 防止误配置过大；需要更大请在代码中上调 */
const MULTI_URL_MAX_CAP = 500;

/**
 * 读取环境变量 `MULTI_URL_MAX_LINKS`：每条「多条链接」任务允许的 URL 数量上限。
 */
export function getMultiUrlMaxLinks(config: ConfigService): number {
  const raw = config.get<string | undefined>('MULTI_URL_MAX_LINKS');
  if (raw === undefined || raw === '') {
    return DEFAULT_MULTI_URL_MAX;
  }
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    return DEFAULT_MULTI_URL_MAX;
  }
  return Math.min(Math.floor(n), MULTI_URL_MAX_CAP);
}
