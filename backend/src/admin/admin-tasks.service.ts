import { Injectable, NotFoundException } from '@nestjs/common';
import type { DownloadTask } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  AdminAuditActions,
  AdminAuditService,
  type AdminAuditContext,
} from '../audit/admin-audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { serializeTask } from '../tasks/tasks.service';
import { TasksService } from '../tasks/tasks.service';
import { AdminListTasksQueryDto } from './dto/admin-list-tasks-query.dto';

@Injectable()
export class AdminTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
    private readonly audit: AdminAuditService,
  ) {}

  async list(query: AdminListTasksQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.DownloadTaskWhereInput = {};

    const email = query.userEmail?.trim().toLowerCase();
    if (query.userId) {
      where.userId = query.userId;
    }
    if (email) {
      where.user = { email: { contains: email } };
    }

    if (query.status) {
      where.status = query.status;
    }
    if (query.sourceType) {
      where.sourceType = query.sourceType;
    }
    const qPart = query.q?.trim();
    if (qPart) {
      where.title = { contains: qPart };
    }
    if (query.createdAfter || query.createdBefore) {
      where.createdAt = {};
      if (query.createdAfter) {
        where.createdAt.gte = new Date(query.createdAfter);
      }
      if (query.createdBefore) {
        where.createdAt.lte = new Date(query.createdBefore);
      }
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.downloadTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { email: true } },
        },
      }),
      this.prisma.downloadTask.count({ where }),
    ]);

    return {
      items: rows.map((t) =>
        AdminTasksService.serializeTaskWithUserEmail(
          t,
          t.user.email ?? '',
        ),
      ),
      total,
      page,
      limit,
    };
  }

  private static serializeTaskWithUserEmail(
    task: DownloadTask,
    ownerEmail: string,
  ) {
    return {
      ...serializeTask(task),
      ownerEmail,
    };
  }

  async findOne(taskId: string) {
    const row = await this.prisma.downloadTask.findUnique({
      where: { id: taskId },
      include: {
        user: { select: { email: true, id: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Task not found');
    }

    /** T-08：详情页挂载该任务产出的入库文件摘要（条目通常有限，单次最多 500 条） */
    const mediaRows = await this.prisma.mediaFile.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        fileName: true,
        relativePath: true,
        sizeBytes: true,
        mimeType: true,
        createdAt: true,
      },
    });

    return {
      ...serializeTask(row),
      ownerUserId: row.userId,
      ownerEmail: row.user.email ?? '',
      mediaFiles: mediaRows.map((m) => ({
        id: m.id,
        fileName: m.fileName,
        relativePath: m.relativePath,
        sizeBytes: m.sizeBytes.toString(),
        mimeType: m.mimeType,
        createdAt: m.createdAt,
      })),
    };
  }

  async remove(taskId: string, ctx: AdminAuditContext): Promise<void> {
    await this.tasksService.removeAsAdmin(taskId);
    await this.audit.appendSafe({
      actorId: ctx.actorId,
      action: AdminAuditActions.TASK_DELETE,
      targetType: 'task',
      targetId: taskId,
      ip: ctx.ip ?? null,
    });
  }
}
