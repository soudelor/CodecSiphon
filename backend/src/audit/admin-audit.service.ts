import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** NF-01：动作枚举（可读性优先，按需扩展） */
export const AdminAuditActions = {
  LOGIN_OK: 'admin_auth.login_ok',
  USER_PATCH: 'admin_user.patch',
  TASK_DELETE: 'admin_task.delete',
  MEDIA_DELETE: 'admin_media.delete',
} as const;

export type AdminAuditContext = {
  actorId: string;
  ip?: string | null;
};

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  static clientIp(req: Request): string | null {
    const xffRaw = req.headers['x-forwarded-for'];
    if (typeof xffRaw === 'string' && xffRaw.trim()) {
      return xffRaw.split(',')[0]?.trim().slice(0, 45) || null;
    }
    const xffArr = req.headers['x-forwarded-for'];
    if (
      Array.isArray(xffArr) &&
      xffArr.length > 0 &&
      typeof xffArr[0] === 'string'
    ) {
      return xffArr[0].trim().slice(0, 45);
    }
    const ip = typeof req.socket?.remoteAddress === 'string'
      ? req.socket.remoteAddress
      : null;
    return ip?.slice(0, 45) ?? null;
  }

  async append(entry: {
    actorId: string;
    action: string;
    targetType: string;
    targetId?: string | null;
    ip?: string | null;
    detail?: Record<string, unknown>;
  }) {
    const detailJson: Prisma.InputJsonValue | undefined =
      entry.detail === undefined ? undefined : (entry.detail as Prisma.InputJsonValue);

    await this.prisma.adminAuditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        ip: entry.ip ?? null,
        ...(detailJson !== undefined ? { detailJson } : {}),
      },
    });
  }

  /** 审计失败不打断业务流程 */
  async appendSafe(entry: Parameters<AdminAuditService['append']>[0]) {
    try {
      await this.append(entry);
    } catch (e) {
      this.logger.warn(
        `audit append failed action=${entry.action}: ${String(e)}`,
      );
    }
  }
}
