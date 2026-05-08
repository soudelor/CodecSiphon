import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ListMediaQueryDto } from './dto/list-media-query.dto';
import { MediaService } from './media.service';

function attachmentContentDisposition(fileName: string): string {
  const ascii =
    fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'download';
  const star = encodeURIComponent(fileName).replace(/'/g, '%27');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${star}`;
}

@UseGuards(AuthGuard('jwt'))
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListMediaQueryDto) {
    return this.media.list(user.id, query);
  }

  @Get(':id/download')
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
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.media.remove(user.id, id);
  }
}
