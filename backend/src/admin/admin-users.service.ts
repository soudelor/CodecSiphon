import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';
import {
  AdminAuditActions,
  AdminAuditService,
} from '../audit/admin-audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminListUsersQueryDto } from './dto/admin-list-users-query.dto';
import { PatchAdminUserDto } from './dto/patch-admin-user.dto';

function serializeUserSummary(u: User) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    isActive: u.isActive,
    disabledAt: u.disabledAt,
    storageQuotaBytes: u.storageQuotaBytes.toString(),
    storageUsedBytes: u.storageUsedBytes.toString(),
    monthlyDownloadQuotaBytes: u.monthlyDownloadQuotaBytes.toString(),
    emailVerifiedAt: u.emailVerifiedAt,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async list(query: AdminListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (query.emailExact?.trim()) {
      where.email = query.emailExact.trim().toLowerCase();
    }
    const emailPart = query.emailContains?.trim().toLowerCase();
    if (emailPart && !(typeof where.email === 'string')) {
      where.email = { contains: emailPart };
    }
    if (query.role) {
      where.role = query.role;
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
    if (query.isActive === 'true') {
      where.isActive = true;
    } else if (query.isActive === 'false') {
      where.isActive = false;
    }

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    const ids = users.map((u) => u.id);
    const aggMap = new Map<
      string,
      { mediaFileCount: number; mediaTotalBytes: bigint }
    >();
    if (ids.length > 0) {
      const groups = await this.prisma.mediaFile.groupBy({
        by: ['userId'],
        where: { userId: { in: ids } },
        _count: { _all: true },
        _sum: { sizeBytes: true },
      });
      for (const g of groups) {
        aggMap.set(g.userId, {
          mediaFileCount: g._count._all,
          mediaTotalBytes: g._sum.sizeBytes ?? 0n,
        });
      }
    }

    return {
      items: users.map((u) => {
        const agg = aggMap.get(u.id);
        return {
          ...serializeUserSummary(u),
          mediaFileCount: agg?.mediaFileCount ?? 0,
          mediaTotalBytes: (agg?.mediaTotalBytes ?? 0n).toString(),
          storageOverQuota: u.storageUsedBytes > u.storageQuotaBytes,
        };
      }),
      total,
      page,
      limit,
    };
  }

  async detail(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [mediaAgg, taskTotals, taskStatusGroups] = await Promise.all([
      this.prisma.mediaFile.aggregate({
        where: { userId: id },
        _count: { id: true },
        _sum: { sizeBytes: true },
      }),
      this.prisma.downloadTask.count({ where: { userId: id } }),
      this.prisma.downloadTask.groupBy({
        by: ['status'],
        where: { userId: id },
        _count: { _all: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of taskStatusGroups) {
      statusCounts[row.status] = row._count._all;
    }

    return {
      ...serializeUserSummary(user),
      storageOverQuota: user.storageUsedBytes > user.storageQuotaBytes,
      mediaFileCount: mediaAgg._count.id,
      mediaTotalBytes: (mediaAgg._sum.sizeBytes ?? 0n).toString(),
      taskTotal: taskTotals,
      taskCountsByStatus: statusCounts,
    };
  }

  async patch(
    actorId: string,
    ip: string | null | undefined,
    targetId: string,
    dto: PatchAdminUserDto,
  ) {
    if (
      dto.role === undefined &&
      dto.storageQuotaBytes === undefined &&
      dto.monthlyDownloadQuotaBytes === undefined &&
      dto.isActive === undefined
    ) {
      throw new BadRequestException(
        'Provide at least one of: role, storageQuotaBytes, monthlyDownloadQuotaBytes, isActive',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: targetId },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (dto.role === UserRole.user && existing.role === UserRole.admin) {
      const admins = await this.prisma.user.count({
        where: { role: UserRole.admin },
      });
      if (admins <= 1) {
        throw new BadRequestException('不能降级或移除最后一个管理员账号');
      }
    }

    if (dto.isActive === false && actorId === targetId) {
      throw new BadRequestException('不能停用自己的账号');
    }

    if (
      dto.isActive === false &&
      existing.role === UserRole.admin &&
      existing.isActive === true
    ) {
      const otherActiveAdmin = await this.prisma.user.count({
        where: {
          role: UserRole.admin,
          isActive: true,
          NOT: { id: targetId },
        },
      });
      if (otherActiveAdmin === 0) {
        throw new BadRequestException(
          '不能停用最后一个可用管理员账号，请先指派其他管理员或启用另一账号后再操作',
        );
      }
    }

    const quota =
      dto.storageQuotaBytes !== undefined
        ? BigInt(dto.storageQuotaBytes)
        : undefined;
    if (quota !== undefined && quota < 0n) {
      throw new BadRequestException('storageQuotaBytes must be non-negative');
    }

    const monthlyDl =
      dto.monthlyDownloadQuotaBytes !== undefined
        ? BigInt(dto.monthlyDownloadQuotaBytes)
        : undefined;
    if (monthlyDl !== undefined && monthlyDl < 0n) {
      throw new BadRequestException(
        'monthlyDownloadQuotaBytes must be non-negative',
      );
    }

    const activeChanged = dto.isActive !== undefined;

    const data: Prisma.UserUpdateInput = {
      ...(dto.role !== undefined ? { role: dto.role } : {}),
      ...(quota !== undefined ? { storageQuotaBytes: quota } : {}),
      ...(monthlyDl !== undefined
        ? { monthlyDownloadQuotaBytes: monthlyDl }
        : {}),
    };
    if (activeChanged) {
      data.isActive = dto.isActive!;
      data.disabledAt = dto.isActive ? null : new Date();
    }

    await this.prisma.user.update({
      where: { id: targetId },
      data,
    });

    await this.audit.appendSafe({
      actorId,
      action: AdminAuditActions.USER_PATCH,
      targetType: 'user',
      targetId,
      ip: ip ?? null,
      detail: {
        role: dto.role,
        quotaChanged: quota !== undefined,
        monthlyDownloadQuotaChanged: monthlyDl !== undefined,
        isActive: dto.isActive,
      },
    });

    return this.detail(targetId);
  }
}
