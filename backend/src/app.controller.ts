import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { SkipReplay } from './common/security/skip-replay.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @SkipReplay()
  getHello(): string {
    return this.appService.getHello();
  }

  /** DB connectivity; use for readiness probes (see docs/ARCHITECTURE.md §7). */
  @Get('health')
  @SkipReplay()
  async health(): Promise<{ status: string; database: 'up' }> {
    return this.appService.getReadiness();
  }
}
