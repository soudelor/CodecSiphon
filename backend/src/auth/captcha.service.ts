import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'crypto';
import Redis from 'ioredis';

const REDIS_PREFIX = 'captcha:v1:';
const TTL_SEC = 180;
/** 去除易混淆字符 */
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 4;

function randomCode(length: number): string {
  const buf = randomBytes(length);
  let s = '';
  for (let i = 0; i < length; i++) {
    s += CHARSET[buf[i]! % CHARSET.length];
  }
  return s;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildCaptchaSvg(text: string): string {
  const w = 140;
  const h = 44;
  const noise: string[] = [];
  for (let i = 0; i < 6; i++) {
    const x1 = Math.floor(Math.random() * w);
    const y1 = Math.floor(Math.random() * h);
    const x2 = Math.floor(Math.random() * w);
    const y2 = Math.floor(Math.random() * h);
    noise.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>`,
    );
  }
  const chars = [...text];
  const parts = chars.map((c, i) => {
    const x = 16 + i * 27 + Math.floor(Math.random() * 5) - 2;
    const y = 31 + Math.floor(Math.random() * 6) - 3;
    const rot = Math.floor(Math.random() * 26) - 13;
    return `<text x="${x}" y="${y}" fill="#8cf0c4" font-size="21" font-family="ui-monospace,Consolas,monospace" font-weight="700" transform="rotate(${rot} ${x} ${y})">${escapeXml(c)}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" fill="#0d141c" rx="8"/>
  ${noise.join('')}
  ${parts.join('')}
</svg>`;
}

@Injectable()
export class CaptchaService implements OnModuleDestroy {
  private readonly log = new Logger(CaptchaService.name);
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    const url = config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379';
    this.redis = new Redis(url, { maxRetriesPerRequest: 3 });
  }

  async create(): Promise<{ captchaId: string; svg: string }> {
    const code = randomCode(CODE_LEN);
    const captchaId = randomUUID();
    const key = `${REDIS_PREFIX}${captchaId}`;
    try {
      const r = await this.redis.set(key, code.toLowerCase(), 'EX', TTL_SEC);
      if (r !== 'OK') {
        throw new Error('Redis SET not OK');
      }
    } catch (e) {
      this.log.warn(`Captcha create failed: ${e}`);
      throw new ServiceUnavailableException('验证码服务不可用，请确认 Redis');
    }
    return { captchaId, svg: buildCaptchaSvg(code) };
  }

  /** 校验成功后删除，避免重复使用 */
  async verifyAndConsume(captchaId: string, userInput: string): Promise<boolean> {
    const trimmed = userInput.trim().toLowerCase();
    if (!trimmed || trimmed.length > 16) {
      return false;
    }
    const key = `${REDIS_PREFIX}${captchaId}`;
    try {
      const expected = await this.redis.get(key);
      await this.redis.del(key);
      if (!expected) {
        return false;
      }
      return expected === trimmed;
    } catch (e) {
      this.log.warn(`Captcha verify failed: ${e}`);
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
