import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PreviewMetadataError } from '../download/preview-metadata.error';
import { mapYtDlpJsonToExtractList } from '../download/ytdlp-extract-list';
import { ytDlpDumpJson } from '../download/ytdlp.dump';
import {
  getUrlExtractMaxItems,
  getUrlExtractPublicPreviewCount,
  getUrlExtractPublicRateLimit,
  getUrlExtractSampleMaxSec,
  UrlExtractPublicRateLimiter,
} from '../common/url-extract-limits';
import { runYtdlp } from '../download/ytdlp.runner';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { resolveUrlExtractSiteHandler } from './sites/resolve-site-handler';
import type { UrlExtractSiteHandler } from './sites/site-handler';

export type UrlExtractPublicResponse = {
  sourceUrl: string;
  total: number;
  previewItems: ReturnType<typeof mapYtDlpJsonToExtractList>['items'];
  hiddenCount: number;
  listTruncated: boolean;
};

export type UrlExtractFullResponse = {
  sourceUrl: string;
  total: number;
  items: ReturnType<typeof mapYtDlpJsonToExtractList>['items'];
  listTruncated: boolean;
};

/** yt-dlp --download-sections 终点时间戳（自 0 起算的秒数） */
function formatYtDlpSectionEnd(totalSeconds: number): string {
  const s = Math.max(1, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function mimeFromSampleExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === '.webm') return 'video/webm';
  if (e === '.mkv') return 'video/x-matroska';
  if (e === '.mov') return 'video/quicktime';
  return 'video/mp4';
}

const SAMPLE_MEDIA_EXT = /\.(mp4|webm|mkv|mov)$/i;

@Injectable()
export class UrlExtractService {
  private readonly log = new Logger(UrlExtractService.name);
  private readonly publicLimiter: UrlExtractPublicRateLimiter;

  constructor(private readonly config: ConfigService) {
    const { limit, windowMs } = getUrlExtractPublicRateLimit(config);
    this.publicLimiter = new UrlExtractPublicRateLimiter(limit, windowMs);
  }

  private ytDlpBin(): string {
    return (
      this.config.get<string>('YTDLP_PATH') ??
      (process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
    );
  }

  private sampleRefererHeaders(): string[] {
    const referer = this.config.get<string>('YTDLP_REFERER')?.trim();
    if (!referer) return [];
    return [`Referer:${referer}`];
  }

  private async dumpForExtract(
    url: string,
    site: UrlExtractSiteHandler,
  ): Promise<unknown> {
    const bin = this.ytDlpBin();
    const base: Parameters<typeof ytDlpDumpJson>[2] = {
      flatPlaylist: true,
      userAgent: this.config.get<string>('YTDLP_USER_AGENT') ?? undefined,
      referer: this.config.get<string>('YTDLP_REFERER') ?? undefined,
      cookiesFile: this.config.get<string>('YTDLP_COOKIES_FILE') ?? undefined,
      cookiesFromBrowser:
        this.config.get<string>('YTDLP_COOKIES_FROM_BROWSER') ?? undefined,
      siteHints: true,
      timeoutMs: 180_000,
    };
    const overrides = site.getYtDlpDumpOverrides?.(url);
    return ytDlpDumpJson(bin, url.trim(), { ...base, ...overrides });
  }

  async previewPublic(
    clientKey: string,
    url: string,
  ): Promise<UrlExtractPublicResponse> {
    const trimmed = url.trim();
    if (!trimmed) {
      throw new BadRequestException({ key: 'errors.previewUrlRequired' });
    }
    const site = resolveUrlExtractSiteHandler(trimmed);
    const extractUrl = site.resolveExtractUrl?.(trimmed) ?? trimmed;
    site.preExtract(trimmed);

    if (!this.publicLimiter.tryConsume(clientKey)) {
      throw new HttpException(
        { key: 'errors.urlExtractRateLimited' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const maxFetch = Math.max(
      getUrlExtractMaxItems(this.config),
      getUrlExtractPublicPreviewCount(this.config),
    );

    try {
      const raw = await this.dumpForExtract(extractUrl, site);
      const parsed = mapYtDlpJsonToExtractList(raw, maxFetch);
      const previewN = getUrlExtractPublicPreviewCount(this.config);
      const previewItems = parsed.items.slice(0, previewN);
      const hiddenCount = Math.max(0, parsed.total - previewItems.length);
      return {
        sourceUrl: trimmed,
        total: parsed.total,
        previewItems,
        hiddenCount,
        listTruncated:
          parsed.listTruncated || parsed.total > previewItems.length,
      };
    } catch (e) {
      if (e instanceof BadRequestException) {
        throw e;
      }
      if (e instanceof PreviewMetadataError) {
        this.log.warn(`previewPublic: ${e.message}`);
        throw new BadRequestException({ key: e.i18nKey });
      }
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(`previewPublic: ${msg.slice(0, 2000)}`);
      throw new BadRequestException({ key: 'errors.previewMetadataFailed' });
    }
  }

  async parseFull(url: string): Promise<UrlExtractFullResponse> {
    const trimmed = url.trim();
    if (!trimmed) {
      throw new BadRequestException({ key: 'errors.previewUrlRequired' });
    }
    const site = resolveUrlExtractSiteHandler(trimmed);
    const extractUrl = site.resolveExtractUrl?.(trimmed) ?? trimmed;
    site.preExtract(trimmed);
    const cap = getUrlExtractMaxItems(this.config);

    try {
      const raw = await this.dumpForExtract(extractUrl, site);
      const parsed = mapYtDlpJsonToExtractList(raw, cap);
      return {
        sourceUrl: trimmed,
        total: parsed.total,
        items: parsed.items,
        listTruncated: parsed.listTruncated,
      };
    } catch (e) {
      if (e instanceof BadRequestException) {
        throw e;
      }
      if (e instanceof PreviewMetadataError) {
        this.log.warn(`parseFull: ${e.message}`);
        throw new BadRequestException({ key: e.i18nKey });
      }
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(`parseFull: ${msg.slice(0, 2000)}`);
      throw new BadRequestException({ key: 'errors.previewMetadataFailed' });
    }
  }

  /**
   * 使用 yt-dlp `--download-sections` 写入临时目录，返回可读文件路径与清理函数。
   * 需本机 PATH 含 **ffmpeg**（节选依赖 ffmpeg）。
   */
  async prepareSampleDownload(videoUrlRaw: string): Promise<{
    filePath: string;
    mimeType: string;
    downloadName: string;
    cleanup: () => Promise<void>;
  }> {
    const videoUrl = videoUrlRaw.trim();
    if (!videoUrl) {
      throw new BadRequestException({ key: 'errors.previewUrlRequired' });
    }
    let parsed: URL;
    try {
      parsed = new URL(videoUrl);
    } catch {
      throw new BadRequestException({
        key: 'errors.urlExtractSampleInvalidUrl',
      });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException({
        key: 'errors.urlExtractSampleInvalidUrl',
      });
    }

    const site = resolveUrlExtractSiteHandler(videoUrl);
    const extractUrl = site.resolveExtractUrl?.(videoUrl) ?? videoUrl;
    site.preExtract(videoUrl);

    const sec = getUrlExtractSampleMaxSec(this.config);
    const sectionSpec = `*0:00-${formatYtDlpSectionEnd(sec)}`;

    const tmpDir = await mkdtemp(join(tmpdir(), 'cs-url-samp-'));
    const outputTemplate = join(tmpDir, 'sample.%(ext)s');
    let cleaned = false;
    const cleanup = async () => {
      if (cleaned) return;
      cleaned = true;
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    };

    const bin = this.ytDlpBin();
    const fmt = 'bv*[height<=720]+ba/best[height<=720]/best';
    try {
      await runYtdlp({
        bin,
        url: extractUrl,
        outputTemplate,
        noPlaylist: true,
        format: fmt,
        mergeOutputFormat: 'mp4',
        downloadSections: sectionSpec,
        reserveProgressTailForMerge: true,
        userAgent: this.config.get<string>('YTDLP_USER_AGENT') ?? undefined,
        addHeaders: this.sampleRefererHeaders(),
        cookiesFile: this.config.get<string>('YTDLP_COOKIES_FILE') ?? undefined,
        cookiesFromBrowser:
          this.config.get<string>('YTDLP_COOKIES_FROM_BROWSER') ?? undefined,
        siteHints: true,
      });
    } catch (e) {
      await cleanup();
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(`prepareSampleDownload: ${msg.slice(0, 2000)}`);
      throw new BadRequestException({ key: 'errors.urlExtractSampleFailed' });
    }

    const names = await readdir(tmpDir);
    const candidates = names.filter((n) => SAMPLE_MEDIA_EXT.test(n));
    if (candidates.length === 0) {
      await cleanup();
      throw new BadRequestException({ key: 'errors.urlExtractSampleFailed' });
    }

    let best = candidates[0];
    let bestSize = 0;
    for (const n of candidates) {
      try {
        const st = await stat(join(tmpDir, n));
        if (st.isFile() && st.size > bestSize) {
          bestSize = st.size;
          best = n;
        }
      } catch {
        /* skip */
      }
    }

    const filePath = join(tmpDir, best);
    const ext = extname(best) || '.mp4';
    return {
      filePath,
      mimeType: mimeFromSampleExt(ext),
      downloadName: `codec-siphon-sample${ext}`,
      cleanup,
    };
  }
}

/** 从 Express 请求解析限流用客户端 key（IP） */
export function urlExtractClientKey(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) {
    return xf.split(',')[0].trim();
  }
  if (Array.isArray(xf) && xf[0]?.trim()) {
    return xf[0].split(',')[0].trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}
