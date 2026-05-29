import { Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from '@prisma/client';

import {

  AdminAuditActions,

  AdminAuditService,

  type AdminAuditContext,

} from '../audit/admin-audit.service';

import { MediaService } from '../media/media.service';

import { PrismaService } from '../prisma/prisma.service';

import { AdminListMediaFilesQueryDto } from './dto/admin-list-media-files-query.dto';



@Injectable()

export class AdminMediaService {

  constructor(

    private readonly prisma: PrismaService,

    private readonly media: MediaService,

    private readonly audit: AdminAuditService,

  ) {}



  async listForUser(userId: string, query: AdminListMediaFilesQueryDto) {

    const user = await this.prisma.user.findUnique({

      where: { id: userId },

      select: { id: true },

    });

    if (!user) {

      throw new NotFoundException('User not found');

    }



    const page = query.page ?? 1;

    const limit = query.limit ?? 20;

    const skip = (page - 1) * limit;



    const where: Prisma.MediaFileWhereInput = { userId };

    const name = query.fileNameContains?.trim();

    if (name) {

      where.fileName = { contains: name };

    }

    if (query.taskId) {

      where.taskId = query.taskId;

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



    const [items, total] = await this.prisma.$transaction([

      this.prisma.mediaFile.findMany({

        where,

        orderBy: { createdAt: 'desc' },

        skip,

        take: limit,

      }),

      this.prisma.mediaFile.count({ where }),

    ]);



    return {

      items: items.map((m) => ({

        id: m.id,

        userId: m.userId,

        taskId: m.taskId,

        folderId: m.folderId,

        fileName: m.fileName,

        relativePath: m.relativePath,

        mimeType: m.mimeType,

        sizeBytes: m.sizeBytes.toString(),

        durationSec: m.durationSec,

        width: m.width,

        height: m.height,

        checksumSha256: m.checksumSha256,

        metadata: m.metadata,

        createdAt: m.createdAt,

      })),

      total,

      page,

      limit,

    };

  }



  async findOne(mediaId: string) {

    const m = await this.prisma.mediaFile.findUnique({

      where: { id: mediaId },

      include: {

        user: { select: { id: true, email: true } },

      },

    });

    if (!m) {

      throw new NotFoundException('Media file not found');

    }



    return {

      id: m.id,

      userId: m.userId,

      ownerEmail: m.user.email ?? '',

      taskId: m.taskId,

      folderId: m.folderId,

      fileName: m.fileName,

      relativePath: m.relativePath,

      mimeType: m.mimeType,

      sizeBytes: m.sizeBytes.toString(),

      durationSec: m.durationSec,

      width: m.width,

      height: m.height,

      checksumSha256: m.checksumSha256,

      metadata: m.metadata,

      createdAt: m.createdAt,

    };

  }



  /** F-03：与用户站删除一致；审计见 NF-01。 */

  async deleteFile(id: string, ctx: AdminAuditContext): Promise<void> {

    await this.media.removeAsAdmin(id);

    await this.audit.appendSafe({

      actorId: ctx.actorId,

      action: AdminAuditActions.MEDIA_DELETE,

      targetType: 'media_file',

      targetId: id,

      ip: ctx.ip ?? null,

    });

  }

}

