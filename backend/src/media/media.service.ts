import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaFile } from '@prisma/client';
import {
  createReadStream,
  existsSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import type { ReadStream } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { ListMediaQueryDto } from './dto/list-media-query.dto';

type MediaWithTaskTitle = MediaFile & {
  task: { title: string | null } | null;
};

function serializeMedia(m: MediaWithTaskTitle) {
  const { task, ...rest } = m;
  return {
    ...rest,
    sizeBytes: m.sizeBytes.toString(),
    taskTitle: task?.title ?? null,
  };
}

function assertSafeRelativePath(relativePath: string): void {
  if (
    !relativePath ||
    relativePath.includes('..') ||
    relativePath.startsWith('/') ||
    relativePath.startsWith('\\')
  ) {
    throw new NotFoundException('Media file not found');
  }
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async list(userId: string, query: ListMediaQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const q = query.q?.trim();

    const where = {
      userId,
      ...(q
        ? {
            fileName: { contains: q, mode: 'insensitive' as const },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.mediaFile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          task: { select: { title: true } },
        },
      }),
      this.prisma.mediaFile.count({ where }),
    ]);

    return {
      items: items.map(serializeMedia),
      total,
      page,
      limit,
    };
  }

  /**
   * 打开用户可见范围内的媒体文件流（用于下载到浏览器）。
   */
  async openDownloadStream(
    userId: string,
    id: string,
  ): Promise<{
    stream: ReadStream;
    fileName: string;
    mimeType: string | null;
    size: number;
  }> {
    const row = await this.prisma.mediaFile.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new NotFoundException('Media file not found');
    }

    assertSafeRelativePath(row.relativePath);

    const root =
      this.config.get<string>('DOWNLOAD_ROOT') ??
      join(process.cwd(), 'data', 'downloads');
    const absPath = join(root, userId, row.relativePath);
    if (!existsSync(absPath)) {
      throw new NotFoundException('File not found on disk');
    }

    const st = statSync(absPath);
    return {
      stream: createReadStream(absPath),
      fileName: row.fileName,
      mimeType: row.mimeType,
      size: st.size,
    };
  }

  /**
   * 删除媒体记录、磁盘文件，并回退 storage_used_bytes。
   */
  async remove(userId: string, id: string): Promise<void> {
    const row = await this.prisma.mediaFile.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new NotFoundException('Media file not found');
    }

    assertSafeRelativePath(row.relativePath);

    const root =
      this.config.get<string>('DOWNLOAD_ROOT') ??
      join(process.cwd(), 'data', 'downloads');
    const absPath = join(root, userId, row.relativePath);
    if (existsSync(absPath)) {
      try {
        unlinkSync(absPath);
      } catch {
        /* ignore locks / transient errors */
      }
    }

    const bytes = row.sizeBytes;

    await this.prisma.$transaction(async (tx) => {
      await tx.taskItem.updateMany({
        where: { mediaFileId: id },
        data: { mediaFileId: null },
      });

      await tx.mediaFile.delete({ where: { id } });

      if (bytes > 0n) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { storageUsedBytes: true },
        });
        if (user) {
          const next =
            user.storageUsedBytes >= bytes
              ? user.storageUsedBytes - bytes
              : 0n;
          await tx.user.update({
            where: { id: userId },
            data: { storageUsedBytes: next },
          });
        }
      }
    });
  }
}
