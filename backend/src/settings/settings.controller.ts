import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserAudienceGuard } from '../common/guards/user-audience.guard';
import { PatchUserSettingsDto } from './dto/patch-user-settings.dto';
import { SettingsService } from './settings.service';

@UseGuards(AuthGuard('jwt'), UserAudienceGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.settings.get(user.id);
  }

  @Patch()
  patch(@CurrentUser() user: AuthUser, @Body() dto: PatchUserSettingsDto) {
    return this.settings.patch(user.id, dto);
  }
}
