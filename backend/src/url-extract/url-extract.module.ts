import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UrlExtractController } from './url-extract.controller';
import { UrlExtractService } from './url-extract.service';

@Module({
  imports: [AuthModule],
  controllers: [UrlExtractController],
  providers: [UrlExtractService],
})
export class UrlExtractModule {}
