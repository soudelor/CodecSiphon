import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipReplay } from '../common/security/skip-replay.decorator';
import { UserAudienceGuard } from '../common/guards/user-audience.guard';
import { ListMediaQueryDto } from './dto/list-media-query.dto';
import { MediaDownloadLinkDto } from './dto/media-download-link.dto';
import { MediaService } from './media.service';

function attachmentContentDisposition(fileName: string): string {
  const ascii =
    fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'download';
  const star = encodeURIComponent(fileName).replace(/'/g, '%27');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${star}`;
}

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), UserAudienceGuard)
  list(@CurrentUser() user: AuthUser, @Query() query: ListMediaQueryDto) {
    return this.media.list(user.id, query);
  }

  /** 换取短期令牌，用于浏览器直链 GET /media/:id/file（流式下载） */
  @Post(':id/download-link')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), UserAudienceGuard)
  createDownloadLink(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MediaDownloadLinkDto,
  ): { path: string; token: string; expiresInSec: number } {
    const token = this.media.createDownloadToken(user.id, id, dto.fileName);
    return {
      path: `/media/${id}/file`,
      token,
      expiresInSec: 600,
    };
  }

  /** 浏览器地址栏 / 新标签打开；仅需 query 中的 dl_token，无 Authorization 头 */
  @Get(':id/file')
  @SkipReplay()
  async downloadByToken(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('dl_token') dlToken: string | undefined,
  ): Promise<StreamableFile> {
    if (!dlToken?.trim()) {
      throw new UnauthorizedException('缺少下载凭证');
    }
    const { userId, contentDispositionFileName } =
      this.media.verifyMediaDownloadToken(dlToken.trim(), id);
    const { stream, fileName, mimeType, size } =
      await this.media.openDownloadStream(userId, id, {
        contentDispositionFileName,
      });
    return new StreamableFile(stream, {
      type: mimeType ?? 'application/octet-stream',
      disposition: attachmentContentDisposition(fileName),
      length: size,
    });
  }

  @Get(':id/download')
  @UseGuards(AuthGuard('jwt'), UserAudienceGuard)
  async download(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const { stream, fileName, mimeType, size } =
      await this.media.openDownloadStream(user.id, id);
    return new StreamableFile(stream, {
      type: mimeType ?? 'application/octet-stream',
      disposition: attachmentContentDisposition(fileName),
      length: size,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'), UserAudienceGuard)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.media.remove(user.id, id);
  }
}
