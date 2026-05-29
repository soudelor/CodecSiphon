import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { getMultiUrlMaxLinks } from '../common/download-limits';
import { PrismaService } from '../prisma/prisma.service';
import { PatchUserSettingsDto } from './dto/patch-user-settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async get(userId: string) {
    const [row, account] = await Promise.all([
      this.prisma.userSettings.findUnique({
        where: { userId },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          storageQuotaBytes: true,
          storageUsedBytes: true,
          monthlyDownloadQuotaBytes: true,
        },
      }),
    ]);
    return {
      preferences: (row?.preferences ?? {}) as Record<string, unknown>,
      downloadDefaults: (row?.downloadDefaults ?? {}) as Record<string, unknown>,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
      multiUrlMaxLinks: getMultiUrlMaxLinks(this.config),
      storageQuotaBytes: (account?.storageQuotaBytes ?? 0n).toString(),
      storageUsedBytes: (account?.storageUsedBytes ?? 0n).toString(),
      monthlyDownloadQuotaBytes: (
        account?.monthlyDownloadQuotaBytes ?? 0n
      ).toString(),
      storageOverQuota: account
        ? account.storageUsedBytes > account.storageQuotaBytes
        : false,
    };
  }

  async patch(userId: string, dto: PatchUserSettingsDto) {
    if (
      dto.preferences === undefined &&
      dto.downloadDefaults === undefined
    ) {
      throw new BadRequestException('请求体需包含 preferences 或 downloadDefaults');
    }
    const prefs =
      dto.preferences !== undefined
        ? (dto.preferences as Prisma.InputJsonValue)
        : undefined;
    const dl =
      dto.downloadDefaults !== undefined
        ? (dto.downloadDefaults as Prisma.InputJsonValue)
        : undefined;

    await this.prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        preferences: (prefs ?? {}) as Prisma.InputJsonValue,
        downloadDefaults: (dl ?? {}) as Prisma.InputJsonValue,
      },
      update: {
        ...(prefs !== undefined && { preferences: prefs }),
        ...(dl !== undefined && { downloadDefaults: dl }),
      },
    });

    return this.get(userId);
  }
}
