import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prefer typed queries / `Prisma.sql` for any raw SQL. Never concatenate user
 * input into `$queryRaw` template strings; use `$queryRawUnsafe` only with
 * fully server-controlled SQL (this codebase avoids it).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
