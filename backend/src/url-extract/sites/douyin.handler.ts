import type { YtDlpDumpOptions } from '../../download/ytdlp.dump';
import { UrlExtractSiteKind } from './site-kind';
import type { UrlExtractSiteHandler } from './site-handler';
import {
  assertDouyinExtractableUrl,
  normalizeDouyinExtractUrl,
} from './douyin-shared';

export const douyinUrlExtractHandler: UrlExtractSiteHandler = {
  kind: UrlExtractSiteKind.DOUYIN,
  resolveExtractUrl(url: string) {
    return normalizeDouyinExtractUrl(url);
  },
  preExtract(url: string) {
    assertDouyinExtractableUrl(normalizeDouyinExtractUrl(url));
  },
  getYtDlpDumpOverrides(url: string): Partial<YtDlpDumpOptions> | undefined {
    try {
      const u = new URL(url.trim());
      const base = (u.pathname || '/').replace(/\/+$/, '') || '/';
      const lower = `${base}/`.toLowerCase();
      if (lower.startsWith('/video/')) {
        return { flatPlaylist: false };
      }
    } catch {
      /* ignore */
    }
    return undefined;
  },
};
