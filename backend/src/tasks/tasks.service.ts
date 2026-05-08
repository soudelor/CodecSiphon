import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  DownloadTask,
  Prisma,
  Subscription,
  TaskSourceType,
  TaskStatus,
} from '@prisma/client';
import { QUEUE_DOWNLOAD } from '../download/download.constants';
import { PrismaService } from '../prisma/prisma.service';
import { mapYtDlpJsonToPreview, ytDlpDumpJson } from '../download/ytdlp.dump';
import { getMultiUrlMaxLinks } from '../common/download-limits';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

function isActivelyDownloading(s: TaskStatus): boolean {
  return (
    s === TaskStatus.pending ||
    s === TaskStatus.queued ||
    s === TaskStatus.parsing ||
    s === TaskStatus.downloading ||
    s === TaskStatus.processing
  );
}

function serializeTask(task: DownloadTask) {
  return {
    ...task,
    bytesDownloaded: task.bytesDownloaded.toString(),
    bytesTotal: task.bytesTotal !== null ? task.bytesTotal.toString() : null,
  };
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_DOWNLOAD) private readonly downloadQueue: Queue,
    private readonly config: ConfigService,
  ) {}

  async create(userId: string, dto: CreateTaskDto) {
    let subscriptionRow: Subscription | null = null;

    if (dto.sourceType === TaskSourceType.subscription) {
      if (!dto.subscriptionId) {
        throw new BadRequestException(
          'subscriptionId is required for subscription tasks',
        );
      }
      subscriptionRow = await this.prisma.subscription.findFirst({
        where: { id: dto.subscriptionId, userId },
      });
      if (!subscriptionRow) {
        throw new ForbiddenException('Subscription not found');
      }
    }

    const options = await this.resolveMergedTaskOptions(
      userId,
      dto.options,
      subscriptionRow,
    );

    const common = {
      userId,
      sourceType: dto.sourceType,
      title: dto.title,
      platform: dto.platform ?? null,
      options,
    };

    let data: Prisma.DownloadTaskUncheckedCreateInput;

    switch (dto.sourceType) {
      case TaskSourceType.single_url: {
        const sourceUrl = dto.sourceUrl?.trim();
        if (!sourceUrl) {
          throw new BadRequestException('sourceUrl is required for single_url');
        }
        data = {
          ...common,
          sourceUrl,
          sourceUrls: [],
          subscriptionId: null,
        };
        break;
      }
      case TaskSourceType.multi_url: {
        const sourceUrls = (dto.sourceUrls ?? []).filter(Boolean);
        if (sourceUrls.length === 0) {
          throw new BadRequestException(
            'sourceUrls must be non-empty for multi_url',
          );
        }
        const multiCap = getMultiUrlMaxLinks(this.config);
        if (sourceUrls.length > multiCap) {
          throw new BadRequestException(`批量链接最多 ${multiCap} 条`);
        }
        data = {
          ...common,
          sourceUrl: null,
          sourceUrls,
          subscriptionId: null,
        };
        break;
      }
      case TaskSourceType.playlist: {
        const sourceUrl = dto.sourceUrl?.trim();
        if (!sourceUrl) {
          throw new BadRequestException('sourceUrl is required for playlist');
        }
        data = {
          ...common,
          sourceUrl,
          sourceUrls: [],
          subscriptionId: null,
        };
        break;
      }
      case TaskSourceType.subscription: {
        data = {
          ...common,
          subscriptionId: dto.subscriptionId!,
          sourceUrl: dto.sourceUrl?.trim() ?? null,
          sourceUrls: [],
        };
        break;
      }
      default:
        throw new BadRequestException('Unsupported sourceType');
    }

    const task = await this.prisma.downloadTask.create({ data });

    try {
      await this.addDownloadJob(task.id);
    } catch {
      await this.prisma.downloadTask.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.failed,
          errorCode: 'QUEUE',
          errorMessage: '无法将任务加入下载队列，请检查 REDIS_URL 与 Redis 服务',
          completedAt: new Date(),
        },
      });
      throw new ServiceUnavailableException(
        'Download queue unavailable; check Redis configuration',
      );
    }

    const queued = await this.prisma.downloadTask.update({
      where: { id: task.id },
      data: { status: TaskStatus.queued },
    });
    return serializeTask(queued);
  }

  /**
   * 新建任务「检测链接」：调用 yt-dlp 拉取元数据（不下载）。
   */
  async previewMediaUrl(url: string) {
    const trimmed = url.trim();
    if (!trimmed) {
      throw new BadRequestException('请填写 URL');
    }
    const bin =
      this.config.get<string>('YTDLP_PATH') ??
      (process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
    try {
      const raw = await ytDlpDumpJson(bin, trimmed);
      return mapYtDlpJsonToPreview(raw);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(msg.slice(0, 2000));
    }
  }

  /**
   * 合并顺序：用户 download_defaults < 订阅 download_options < 任务 options（后者覆盖前者）。
   */
  private async resolveMergedTaskOptions(
    userId: string,
    taskOptions: Record<string, unknown> | undefined,
    subscription: Subscription | null,
  ): Promise<Prisma.InputJsonValue> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { downloadDefaults: true },
    });

    const defaults = this.shallowJsonObject(settings?.downloadDefaults);
    const subPart = subscription
      ? this.shallowJsonObject(subscription.downloadOptions)
      : {};
    const explicit = this.shallowJsonObject(taskOptions);

    return { ...defaults, ...subPart, ...explicit } as Prisma.InputJsonValue;
  }

  private shallowJsonObject(
    v: Prisma.JsonValue | Record<string, unknown> | null | undefined,
  ): Record<string, unknown> {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return { ...(v as Record<string, unknown>) };
    }
    return {};
  }

  async list(userId: string, query: ListTasksQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.downloadTask.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.downloadTask.count({ where: { userId } }),
    ]);

    return {
      items: items.map(serializeTask),
      total,
      page,
      limit,
    };
  }

  async findOne(userId: string, id: string) {
    const task = await this.prisma.downloadTask.findFirst({
      where: { id, userId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return serializeTask(task);
  }

  async update(userId: string, id: string, dto: UpdateTaskDto) {
    const existing = await this.prisma.downloadTask.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    if (dto.status === TaskStatus.paused) {
      if (existing.status === TaskStatus.paused) {
        throw new BadRequestException('任务已是暂停状态');
      }
      if (!isActivelyDownloading(existing.status)) {
        throw new BadRequestException(
          '仅在进行中（待处理/排队/下载等）的任务可以暂停',
        );
      }
      const job = await this.downloadQueue.getJob(id);
      if (job) {
        try {
          const state = await job.getState();
          if (state === 'waiting' || state === 'delayed') {
            await job.remove();
          }
        } catch {
          /* ignore */
        }
      }
      const task = await this.prisma.downloadTask.update({
        where: { id },
        data: { status: TaskStatus.paused },
      });
      return serializeTask(task);
    }

    if (dto.status === TaskStatus.cancelled) {
      if (existing.status === TaskStatus.cancelled) {
        throw new BadRequestException('任务已取消');
      }
      if (existing.status === TaskStatus.completed) {
        throw new BadRequestException('已完成的任务无法取消');
      }
      const job = await this.downloadQueue.getJob(id);
      if (job) {
        try {
          await job.remove();
        } catch {
          /* ignore */
        }
      }
      const task = await this.prisma.downloadTask.update({
        where: { id },
        data: { status: TaskStatus.cancelled },
      });
      return serializeTask(task);
    }

    if (dto.status === TaskStatus.queued) {
      if (existing.status === TaskStatus.paused) {
        try {
          await this.ensureDownloadJob(id);
        } catch (err) {
          if (err instanceof BadRequestException) throw err;
          throw new ServiceUnavailableException(
            '无法重新入队，请检查 Redis 与队列配置',
          );
        }
        const task = await this.prisma.downloadTask.update({
          where: { id },
          data: { status: TaskStatus.queued },
        });
        return serializeTask(task);
      }

      if (existing.status === TaskStatus.failed) {
        try {
          await this.ensureDownloadJob(id);
        } catch (err) {
          if (err instanceof BadRequestException) throw err;
          throw new ServiceUnavailableException(
            '无法重新入队，请检查 Redis 与队列配置',
          );
        }
        const task = await this.prisma.downloadTask.update({
          where: { id },
          data: {
            status: TaskStatus.queued,
            errorCode: null,
            errorMessage: null,
            completedAt: null,
            progressPercent: 0,
            bytesDownloaded: BigInt(0),
          },
        });
        return serializeTask(task);
      }

      throw new BadRequestException(
        '仅支持从「已暂停」继续或从「失败」重试',
      );
    }

    throw new BadRequestException('不支持的状态更新');
  }

  /**
   * 删除任务：移除队列作业、磁盘上该任务目录、关联媒体库记录并回退用户用量。
   */
  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.prisma.downloadTask.findFirst({
      where: { id, userId },
      include: { mediaFiles: { select: { sizeBytes: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    const job = await this.downloadQueue.getJob(id);
    if (job) {
      try {
        await job.remove();
      } catch {
        /* 活动中的作业可能暂时无法移除 */
      }
    }

    const root =
      this.config.get<string>('DOWNLOAD_ROOT') ??
      join(process.cwd(), 'data', 'downloads');
    const taskDir = join(root, userId, id);
    if (existsSync(taskDir)) {
      try {
        rmSync(taskDir, { recursive: true, force: true });
      } catch {
        /* 忽略占用等 */
      }
    }

    const totalBytes = existing.mediaFiles.reduce(
      (s, m) => s + m.sizeBytes,
      0n,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.taskItem.updateMany({
        where: { taskId: id },
        data: { mediaFileId: null },
      });
      await tx.mediaFile.deleteMany({ where: { taskId: id } });

      if (totalBytes > 0n) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { storageUsedBytes: true },
        });
        if (user) {
          const next =
            user.storageUsedBytes >= totalBytes
              ? user.storageUsedBytes - totalBytes
              : 0n;
          await tx.user.update({
            where: { id: userId },
            data: { storageUsedBytes: next },
          });
        }
      }

      await tx.downloadTask.delete({ where: { id } });
    });
  }

  private async addDownloadJob(taskId: string): Promise<void> {
    await this.downloadQueue.add(
      'run',
      { taskId },
      {
        jobId: taskId,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  /**
   * 为继续/重试准备队列：若已有非活动作业则移除后重新添加。
   * 活动中的作业会拒绝，避免重复 Worker。
   */
  private async ensureDownloadJob(taskId: string): Promise<void> {
    const job = await this.downloadQueue.getJob(taskId);
    if (job) {
      const state = await job.getState();
      if (state === 'waiting' || state === 'delayed') {
        return;
      }
      if (state === 'active') {
        throw new BadRequestException(
          '任务正在执行中，请等待当前进度结束后再继续',
        );
      }
      try {
        await job.remove();
      } catch {
        /* ignore */
      }
    }
    await this.addDownloadJob(taskId);
  }
}
