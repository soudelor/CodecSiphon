import type { YtDlpDumpOptions } from '../../download/ytdlp.dump';
import type { UrlExtractSiteKind } from './site-kind';

/**
 * 各站点在「链接解析」管线中的钩子。
 * - preExtract：在拉起 yt-dlp 之前执行（可抛业务异常）。
 * - resolveExtractUrl：将用户粘贴的 URL 规范化为传给 yt-dlp 的地址（未实现则沿用原始 trim 后 URL）。
 * - getYtDlpDumpOverrides：与全局默认 dump 选项浅合并，未实现则仅用默认策略。
 */
export interface UrlExtractSiteHandler {
  readonly kind: UrlExtractSiteKind;
  preExtract(url: string): void;
  resolveExtractUrl?(url: string): string;
  getYtDlpDumpOverrides?(url: string): Partial<YtDlpDumpOptions> | undefined;
}
