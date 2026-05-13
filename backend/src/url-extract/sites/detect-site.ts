import { isBilibiliUrl } from '../../download/ytdlp.runner';
import { isDouyinHostname } from './douyin-shared';
import { UrlExtractSiteKind } from './site-kind';

function isYoutubeHost(host: string): boolean {
  return (
    host === 'youtu.be' ||
    host === 'www.youtube.com' ||
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'www.youtube-nocookie.com' ||
    host === 'youtube-nocookie.com'
  );
}

/**
 * 根据 URL 判定站点类型（仅用于派发逻辑，与 yt-dlp 内置 extractor 无强绑定）。
 */
export function detectUrlExtractSite(rawUrl: string): UrlExtractSiteKind {
  try {
    const u = new URL(rawUrl.trim());
    const host = u.hostname.toLowerCase();
    if (isDouyinHostname(host)) {
      return UrlExtractSiteKind.DOUYIN;
    }
    if (isBilibiliUrl(rawUrl.trim())) {
      return UrlExtractSiteKind.BILIBILI;
    }
    if (isYoutubeHost(host)) {
      return UrlExtractSiteKind.YOUTUBE;
    }
    return UrlExtractSiteKind.GENERIC;
  } catch {
    return UrlExtractSiteKind.GENERIC;
  }
}
