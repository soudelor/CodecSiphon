import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from '../../auth/auth.module';
import { ReplayProtectionGuard } from './replay-protection.guard';
import { ReplayProtectionService } from './replay-protection.service';

@Module({
  imports: [AuthModule],
  providers: [
    ReplayProtectionService,
    { provide: APP_GUARD, useClass: ReplayProtectionGuard },
  ],
  exports: [ReplayProtectionService],
})
export class SecurityModule {}
