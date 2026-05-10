import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Prisma, TaskSourceType, TaskStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_DOWNLOAD } from './download.constants';
import {
  basename,
  collectMediaFiles,
  guessMime,
} from './storage.util';
import { runYtdlp } from './ytdlp.runner';
import { sourceUrlsFromJson } from '../common/source-urls.util';

export type DownloadJobPayload = {
  taskId: string;
};

function readOptionString(
  options: Prisma.JsonValue,
  key: string,
): string | undefined {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return undefined;
  }
  const v = (options as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : undefined;
}

function readOptionBool(
  options: Prisma.JsonValue,
  key: string,
): boolean | undefined {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return undefined;
  }
  const v = (options as Record<string, unknown>)[key];
  return typeof v === 'boolean' ? v : undefined;
}

@Injectable()
@Processor(QUEUE_DOWNLOAD, { concurrency: 2 })
export class DownloadProcessor extends WorkerHost {
  private readonly log = new Logger(DownloadProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<DownloadJobPayload>): Promise<void> {
    const taskId = job.data?.taskId;
    if (!taskId) {
      this.log.warn('Job missing taskId');
      return;
    }

    this.log.log(`Download job received taskId=${taskId}`);

    const task = await this.prisma.downloadTask.findUnique({
      where: { id: taskId },
    });
    if (!task) {
      this.log.warn(`Task ${taskId} not found`);
      return;
    }

    this.log.log(
      `Task ${taskId} load ok status=${task.status} sourceType=${task.sourceType} urlCount(resolved later)`,
    );

    if (
      task.status === TaskStatus.cancelled ||
      task.status === TaskStatus.paused
    ) {
      this.log.log(
        `Task ${taskId} skip job: status=${task.status} (cancelled/paused)`,
      );
      return;
    }

    if (task.status === TaskStatus.failed || task.status === TaskStatus.completed) {
      this.log.log(
        `Task ${taskId} skip job: status=${task.status} (already terminal)`,
      );
      return;
    }

    const urls = await this.resolveUrls(task);
    if (urls.length === 0) {
      await this.failTask(taskId, 'NO_URL', '没有可下载的 URL');
      return;
    }

    this.log.log(
      `Task ${taskId} resolveUrls → ${urls.length} URL(s); first=${urls[0]?.slice(0, 120) ?? ''}${urls[0] && urls[0].length > 120 ? '…' : ''}`,
    );

    const root =
      this.config.get<string>('DOWNLOAD_ROOT') ??
      join(process.cwd(), 'data', 'downloads');
    const taskDir = join(root, task.userId, taskId);
    mkdirSync(taskDir, { recursive: true });

    const ytdlpBin =
      this.config.get<string>('YTDLP_PATH') ??
      (process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

    this.log.log(
      `Task ${taskId} downloadRoot=${root} taskDir=${taskDir} ytdlpBin=${ytdlpBin}`,
    );

    const playlistMode = task.sourceType === TaskSourceType.playlist;
    const fmt = readOptionString(task.options, 'format');
    const effectiveFmt = fmt?.trim() || 'bv*+ba/b';
    const proxy =
      readOptionString(task.options, 'proxy_url') ??
      readOptionString(task.options, 'proxy');

    await this.prisma.downloadTask.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.downloading,
        startedAt: task.startedAt ?? new Date(),
        progressPercent: 2,
        errorCode: null,
        errorMessage: null,
      },
    });

    this.log.log(
      `Task ${taskId} status=downloading progressPercent=2（多流/合并任务会将 [download] 映射到约 0–88%，合并与后处理占 89–100%）`,
    );

    await this.appendLog(taskId, 'info', `开始下载，共 ${urls.length} 个地址`);

    const outTemplate = join(taskDir, '%(title)s [%(id)s].%(ext)s');

    const flushProgress = async (
      taskIdInner: string,
      pct: number,
    ): Promise<void> => {
      await this.prisma.downloadTask.update({
        where: { id: taskIdInner },
        data: { progressPercent: pct },
      });
    };

    const playlistItems = readOptionString(task.options, 'playlist_items');
    const mergeOutputFormat = readOptionString(
      task.options,
      'merge_output_format',
    );
    const subLangs = readOptionString(task.options, 'sub_langs');
    const writeSubtitles = readOptionBool(task.options, 'write_subs') === true;
    const embedSubtitles = readOptionBool(task.options, 'embed_subs') === true;
    const embedMetadata =
      readOptionBool(task.options, 'embed_metadata') === true;
    const embedThumbnail =
      readOptionBool(task.options, 'embed_thumbnail') === true;

    try {
      for (let i = 0; i < urls.length; i++) {
        const fresh = await this.prisma.downloadTask.findUnique({
          where: { id: taskId },
        });
        if (
          !fresh ||
          fresh.status === TaskStatus.cancelled ||
          fresh.status === TaskStatus.paused
        ) {
          this.log.log(`Task ${taskId} stopped (${fresh?.status})`);
          return;
        }

        await this.appendLog(taskId, 'info', `[${i + 1}/${urls.length}] ${urls[i]}`);

        const addHeaders: string[] = [];
        const optReferer = readOptionString(task.options, 'referer');
        const envReferer = this.config.get<string>('YTDLP_REFERER');
        const referer = optReferer ?? envReferer;
        if (referer?.trim()) {
          addHeaders.push(`Referer:${referer.trim()}`);
        }

        const userAgent =
          readOptionString(task.options, 'user_agent') ??
          this.config.get<string>('YTDLP_USER_AGENT') ??
          undefined;

        const cookiesFile =
          readOptionString(task.options, 'cookies_file') ??
          this.config.get<string>('YTDLP_COOKIES_FILE') ??
          undefined;

        const cookiesFromBrowser =
          readOptionString(task.options, 'cookies_from_browser') ??
          this.config.get<string>('YTDLP_COOKIES_FROM_BROWSER') ??
          undefined;

        const siteHints = readOptionBool(task.options, 'site_hints');

        const nUrl = urls.length;
        let lastReported = Math.max(
          2,
          Math.min(98, Math.round((i / nUrl) * 100)),
        );
        let progressDebounce: ReturnType<typeof setTimeout> | null = null;
        const PROGRESS_DEBOUNCE_MS = 400;

        const mapOverall = (localRaw: number) => {
          const local = Math.min(100, Math.max(0, localRaw));
          const frac = (i + local / 100) / nUrl;
          return Math.min(99, Math.max(2, Math.round(frac * 100)));
        };

        const reportStreamProgress = (local: number) => {
          const overall = mapOverall(local);
          const mono = Math.max(lastReported, overall);
          if (mono <= lastReported) return;
          lastReported = mono;
          if (progressDebounce) clearTimeout(progressDebounce);
          progressDebounce = setTimeout(() => {
            progressDebounce = null;
            void this.prisma.downloadTask
              .update({
                where: { id: taskId },
                data: { progressPercent: lastReported },
              })
              .catch(() => {});
          }, PROGRESS_DEBOUNCE_MS);
        };

        const awaitProgressFlush = async () => {
          if (progressDebounce) {
            clearTimeout(progressDebounce);
            progressDebounce = null;
          }
          try {
            await this.prisma.downloadTask.update({
              where: { id: taskId },
              data: { progressPercent: lastReported },
            });
          } catch {
            /* 任务已删除等情况忽略 */
          }
        };

        try {
          await runYtdlp({
            bin: ytdlpBin,
            url: urls[i],
            outputTemplate: outTemplate,
            noPlaylist: !playlistMode,
            format: fmt,
            proxy,
            userAgent: userAgent ?? undefined,
            addHeaders: addHeaders.length > 0 ? addHeaders : undefined,
            cookiesFile: cookiesFile ?? undefined,
            cookiesFromBrowser: cookiesFromBrowser ?? undefined,
            siteHints: siteHints !== false,
            playlistItems: playlistItems ?? undefined,
            mergeOutputFormat: mergeOutputFormat ?? undefined,
            subLangs: subLangs ?? undefined,
            writeSubtitles,
            embedSubtitles,
            embedMetadata,
            embedThumbnail,
            reserveProgressTailForMerge:
              /\+/.test(effectiveFmt) ||
              !!mergeOutputFormat?.trim() ||
              embedSubtitles ||
              embedThumbnail ||
              embedMetadata,
            onProgress: reportStreamProgress,
            onDiagnostic: (event, detail) => {
              this.log.log(
                `[${taskId}] yt-dlp ${event}${detail ? `: ${detail}` : ''}`,
              );
            },
          });
        } finally {
          await awaitProgressFlush();
        }

        const pct = Math.min(
          99,
          Math.round(((i + 1) / urls.length) * 100),
        );
        lastReported = pct;
        this.log.log(
          `Task ${taskId} URL ${i + 1}/${urls.length} yt-dlp 完成 → progressPercent=${pct}`,
        );
        await flushProgress(taskId, pct);
      }

      const media = collectMediaFiles(taskDir);
      if (media.length === 0) {
        await this.failTask(
          taskId,
          'NO_OUTPUT',
          'yt-dlp 成功结束但未在输出目录找到媒体文件',
        );
        return;
      }

      const totalAdded = media.reduce((s, f) => s + f.size, 0n);

      await this.prisma.$transaction(async (tx) => {
        for (const f of media) {
          const fileName = basename(f.absPath);
          const relativePath = `${taskId}/${fileName}`;
          await tx.mediaFile.create({
            data: {
              userId: task.userId,
              taskId: task.id,
              fileName,
              relativePath,
              mimeType: guessMime(f.absPath),
              sizeBytes: f.size,
              metadata: {} as Prisma.InputJsonValue,
            },
          });
        }

        await tx.user.update({
          where: { id: task.userId },
          data: { storageUsedBytes: { increment: totalAdded } },
        });

        await tx.downloadTask.update({
          where: { id: taskId },
          data: {
            status: TaskStatus.completed,
            progressPercent: 100,
            completedAt: new Date(),
            bytesDownloaded: totalAdded,
            bytesTotal: totalAdded,
          },
        });
      });

      await this.appendLog(taskId, 'info', `完成，写入 ${media.length} 个文件`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error(
        `Task ${taskId} YTDLP_ERROR: ${message.slice(0, 2000)}`,
      );
      await this.failTask(taskId, 'YTDLP_ERROR', message.slice(0, 4000));
      if (/412|Precondition Failed|BiliBili|bilibili/i.test(message)) {
        await this.appendLog(
          taskId,
          'warn',
          'B 站 HTTP 412：请在服务器配置已登录 Cookie（见 backend/.env.example 中 YTDLP_COOKIES_*），' +
            '并执行 yt-dlp -U 升级；任务 options 可传 cookies_file、cookies_from_browser、referer。',
        );
      }
    }
  }

  private async resolveUrls(task: {
    id: string;
    userId: string;
    sourceType: TaskSourceType;
    sourceUrl: string | null;
    sourceUrls: Prisma.JsonValue;
    subscriptionId: string | null;
  }): Promise<string[]> {
    if (
      task.sourceType === TaskSourceType.single_url ||
      task.sourceType === TaskSourceType.playlist
    ) {
      return task.sourceUrl ? [task.sourceUrl] : [];
    }
    if (task.sourceType === TaskSourceType.multi_url) {
      return sourceUrlsFromJson(task.sourceUrls);
    }
    if (task.sourceType === TaskSourceType.subscription) {
      if (task.sourceUrl) return [task.sourceUrl];
      if (!task.subscriptionId) return [];
      const sub = await this.prisma.subscription.findFirst({
        where: { id: task.subscriptionId, userId: task.userId },
      });
      return sub?.sourceUrl ? [sub.sourceUrl] : [];
    }
    return [];
  }

  private async failTask(
    taskId: string,
    code: string,
    message: string,
  ): Promise<void> {
    await this.prisma.downloadTask.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.failed,
        errorCode: code,
        errorMessage: message,
        completedAt: new Date(),
      },
    });
    await this.appendLog(taskId, 'error', message);
  }

  private async appendLog(
    taskId: string,
    level: 'info' | 'warn' | 'error',
    message: string,
  ): Promise<void> {
    await this.prisma.taskLog.create({
      data: {
        taskId,
        level,
        message: message.slice(0, 8000),
      },
    });
  }
}
