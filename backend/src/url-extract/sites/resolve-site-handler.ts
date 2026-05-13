import { UrlExtractSiteKind } from './site-kind';
import { detectUrlExtractSite } from './detect-site';
import { douyinUrlExtractHandler } from './douyin.handler';
import { createGenericUrlExtractHandler } from './generic.handler';
import type { UrlExtractSiteHandler } from './site-handler';

/**
 * 先识别站点类型，再返回对应处理器；未单独实现的站类使用通用处理器（仅打标，逻辑与 GENERIC 相同）。
 */
export function resolveUrlExtractSiteHandler(
  url: string,
): UrlExtractSiteHandler {
  const kind = detectUrlExtractSite(url);
  if (kind === UrlExtractSiteKind.DOUYIN) {
    return douyinUrlExtractHandler;
  }
  return createGenericUrlExtractHandler(kind);
}

export { detectUrlExtractSite, UrlExtractSiteKind };
