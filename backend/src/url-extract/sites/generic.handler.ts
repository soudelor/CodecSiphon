import type { UrlExtractSiteKind } from './site-kind';
import type { UrlExtractSiteHandler } from './site-handler';

export function createGenericUrlExtractHandler(
  kind: UrlExtractSiteKind,
): UrlExtractSiteHandler {
  return {
    kind,
    preExtract() {
      /* 无预检；依赖 yt-dlp 与统一 map */
    },
  };
}
