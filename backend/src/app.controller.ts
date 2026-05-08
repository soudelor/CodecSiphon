import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** DB connectivity; use for readiness probes (see docs/ARCHITECTURE.md §7). */
  @Get('health')
  async health(): Promise<{ status: string; database: 'up' }> {
    return this.appService.getReadiness();
  }
}
