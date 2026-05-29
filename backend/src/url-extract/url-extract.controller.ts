import { Body, Controller, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import { SkipReplay } from '../common/security/skip-replay.decorator';
import { UserAudienceGuard } from '../common/guards/user-audience.guard';
import { UrlExtractBodyDto } from './dto/url-extract-body.dto';
import { UrlExtractSampleBodyDto } from './dto/url-extract-sample-body.dto';
import {
  UrlExtractService,
  urlExtractClientKey,
} from './url-extract.service';

@Controller('url-extract')
export class UrlExtractController {
  constructor(private readonly urlExtract: UrlExtractService) {}

  @Post('preview-public')
  @HttpCode(200)
  @SkipReplay()
  previewPublic(@Req() req: Request, @Body() body: UrlExtractBodyDto) {
    return this.urlExtract.previewPublic(urlExtractClientKey(req), body.url);
  }

  @Post('parse')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'), UserAudienceGuard)
  parse(@Body() body: UrlExtractBodyDto) {
    return this.urlExtract.parseFull(body.url);
  }

  /**
   * 节选短视频片下载（yt-dlp --download-sections；需服务器安装 ffmpeg）。
   */
  @Post('sample')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'), UserAudienceGuard)
  async sample(
    @Body() body: UrlExtractSampleBodyDto,
    @Res() res: Response,
  ): Promise<void> {
    const prepared = await this.urlExtract.prepareSampleDownload(
      body.videoUrl,
    );
    res.setHeader('Content-Type', prepared.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(prepared.downloadName)}`,
    );
    try {
      await pipeline(createReadStream(prepared.filePath), res);
    } finally {
      await prepared.cleanup();
    }
  }
}
