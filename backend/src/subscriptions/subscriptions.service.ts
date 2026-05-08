import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { ListSubscriptionsQueryDto } from './dto/list-subscriptions-query.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: ListSubscriptionsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      userId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async create(userId: string, dto: CreateSubscriptionDto) {
    return this.prisma.subscription.create({
      data: {
        userId,
        type: dto.type,
        sourceUrl: dto.sourceUrl.trim(),
        displayName: dto.displayName?.trim() ?? null,
        checkIntervalSec: dto.checkIntervalSec ?? undefined,
        downloadOptions: (dto.downloadOptions ??
          {}) as Prisma.InputJsonValue,
        filterRules: (dto.filterRules ?? {}) as Prisma.InputJsonValue,
        notifyEmail: dto.notifyEmail ?? undefined,
        notifyDesktop: dto.notifyDesktop ?? undefined,
      },
    });
  }

  async findOne(userId: string, id: string) {
    const row = await this.prisma.subscription.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new NotFoundException('Subscription not found');
    }
    return row;
  }

  async update(userId: string, id: string, dto: UpdateSubscriptionDto) {
    await this.findOne(userId, id);

    const data: Prisma.SubscriptionUpdateInput = {};

    if (dto.type !== undefined) data.type = dto.type;
    if (dto.sourceUrl !== undefined) data.sourceUrl = dto.sourceUrl.trim();
    if (dto.displayName !== undefined) {
      data.displayName =
        dto.displayName === null ? null : dto.displayName.trim() || null;
    }
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.checkIntervalSec !== undefined) {
      data.checkIntervalSec = dto.checkIntervalSec;
    }
    if (dto.downloadOptions !== undefined) {
      data.downloadOptions = dto.downloadOptions as Prisma.InputJsonValue;
    }
    if (dto.filterRules !== undefined) {
      data.filterRules = dto.filterRules as Prisma.InputJsonValue;
    }
    if (dto.notifyEmail !== undefined) data.notifyEmail = dto.notifyEmail;
    if (dto.notifyDesktop !== undefined) {
      data.notifyDesktop = dto.notifyDesktop;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('请求体至少包含一个可更新字段');
    }

    return this.prisma.subscription.update({
      where: { id },
      data,
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const row = await this.prisma.subscription.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new NotFoundException('Subscription not found');
    }
    await this.prisma.subscription.delete({ where: { id } });
  }
}
