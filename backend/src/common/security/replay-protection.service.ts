import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  DEFAULT_REPLAY_WINDOW_MS,
  REPLAY_REDIS_PREFIX,
} from './replay-protection.constants';

@Injectable()
export class ReplayProtectionService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly ttlSec: number;

  constructor(config: ConfigService) {
    const url = config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379';
    this.redis = new Redis(url, { maxRetriesPerRequest: 3 });
    const windowMs = Number(config.get<string>('REPLAY_WINDOW_MS'));
    const ms = Number.isFinite(windowMs)
      ? windowMs
      : DEFAULT_REPLAY_WINDOW_MS;
    this.ttlSec = Math.max(60, Math.ceil(ms / 1000));
  }

  /**
   * Stores nonce on first use. Returns false if the same nonce was already seen
   * within the TTL for this scope (replay).
   */
  async checkAndRemember(scope: string, nonce: string): Promise<boolean> {
    const key = `${REPLAY_REDIS_PREFIX}${scope}:${nonce}`;
    const r = await this.redis.set(key, '1', 'EX', this.ttlSec, 'NX');
    return r === 'OK';
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
