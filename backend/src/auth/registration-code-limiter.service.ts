import { HttpException, HttpStatus, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import Redis from 'ioredis';



const PREFIX = 'regotp:v1:';



@Injectable()

export class RegistrationCodeLimiterService implements OnModuleDestroy {

  private readonly redis: Redis;

  private readonly logger = new Logger(RegistrationCodeLimiterService.name);

  private readonly windowSec: number;

  private readonly maxIp: number;

  private readonly maxEmail: number;



  constructor(config: ConfigService) {

    const url = config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379';

    this.redis = new Redis(url, { maxRetriesPerRequest: 3 });

    this.windowSec = Math.max(

      60,

      Number(config.get<string>('REGISTRATION_CODE_RATE_WINDOW_SEC') ?? 3600),

    );

    this.maxIp = Math.max(

      1,

      Number(config.get<string>('REGISTRATION_CODE_IP_LIMIT') ?? 60),

    );

    this.maxEmail = Math.max(

      1,

      Number(config.get<string>('REGISTRATION_CODE_EMAIL_LIMIT') ?? 12),

    );

  }



  async onModuleDestroy(): Promise<void> {

    await this.redis.quit();

  }



  private async incrInWindow(key: string): Promise<number> {

    const n = await this.redis.incr(key);

    if (n === 1) {

      await this.redis.expire(key, this.windowSec);

    }

    return n;

  }



  /** 超限抛出 429；Redis 不可用时放行（与 ForgotPasswordLimiter 一致）。 */

  async assertWithinLimits(

    normalizedIp: string,

    normalizedEmail: string,

  ): Promise<void> {

    const ipKey = `${PREFIX}ip:${normalizedIp}`;

    const emKey = `${PREFIX}em:${normalizedEmail}`;

    try {

      const ipN = await this.incrInWindow(ipKey);

      if (ipN > this.maxIp) {

        await this.redis.decr(ipKey).catch(() => {});

        throw new HttpException(

          '请求过于频繁，请稍后再试',

          HttpStatus.TOO_MANY_REQUESTS,

        );

      }

      const emN = await this.incrInWindow(emKey);

      if (emN > this.maxEmail) {

        await this.redis.decr(emKey).catch(() => {});

        await this.redis.decr(ipKey).catch(() => {});

        throw new HttpException(

          '请求过于频繁，请稍后再试',

          HttpStatus.TOO_MANY_REQUESTS,

        );

      }

    } catch (e: unknown) {

      if (e instanceof HttpException) throw e;

      this.logger.warn(

        `Registration-code rate limit Redis error: ${String(e)}; allowing request`,

      );

    }

  }

}


