import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DownloadModule } from './download/download.module';
import { PrismaModule } from './prisma/prisma.module';
import { MediaModule } from './media/media.module';
import { SettingsModule } from './settings/settings.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { SecurityModule } from './common/security/security.module';
import { TasksModule } from './tasks/tasks.module';
import { UrlExtractModule } from './url-extract/url-extract.module';

/**
 * Always resolve `backend/.env` relative to this module (`src/` or `dist/`),
 * then allow cwd-based overrides (monorepo root vs `backend/`).
 */
const backendRoot = join(__dirname, '..');
const envCandidates = [
  join(backendRoot, '.env'),
  join(process.cwd(), 'backend', '.env'),
  join(process.cwd(), '.env'),
];
const envFilePaths = [...new Set(envCandidates.filter((path) => existsSync(path)))];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envFilePaths.length > 0 ? envFilePaths : undefined,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url:
            config.get<string>('REDIS_URL') ??
            'redis://127.0.0.1:6379',
        },
      }),
    }),
    PrismaModule,
    DownloadModule,
    AuthModule,
    SecurityModule,
    MediaModule,
    SubscriptionsModule,
    SettingsModule,
    TasksModule,
    UrlExtractModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
