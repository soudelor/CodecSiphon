import { Global, Module } from '@nestjs/common';
import { AdminAuditService } from './admin-audit.service';

/** 供 AuthModule / AdminModule 复用 NF-01 审计；标记为全局避免多处 import 重复实例。 */
@Global()
@Module({
  providers: [AdminAuditService],
  exports: [AdminAuditService],
})
export class AuditModule {}
