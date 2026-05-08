import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import {
  DEFAULT_REPLAY_WINDOW_MS,
  REPLAY_HEADERS,
} from './replay-protection.constants';
import { ReplayProtectionService } from './replay-protection.service';
import { SKIP_REPLAY_KEY } from './skip-replay.decorator';

/** UUID v4 (case-insensitive). */
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class ReplayProtectionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly replay: ReplayProtectionService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.method === 'OPTIONS') {
      return true;
    }

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_REPLAY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return true;
    }

    const windowMsRaw = this.config.get<string>('REPLAY_WINDOW_MS');
    const windowMs = Number(windowMsRaw);
    const skewMs = Number.isFinite(windowMs)
      ? windowMs
      : DEFAULT_REPLAY_WINDOW_MS;

    const tsHeader = req.headers[REPLAY_HEADERS.timestamp];
    const nonceHeader = req.headers[REPLAY_HEADERS.nonce];
    if (typeof tsHeader !== 'string' || typeof nonceHeader !== 'string') {
      throw new HttpException(
        'Missing anti-replay headers (X-Client-Timestamp, X-Client-Nonce)',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!UUID_V4.test(nonceHeader)) {
      throw new HttpException(
        'Invalid X-Client-Nonce',
        HttpStatus.BAD_REQUEST,
      );
    }

    const parsedTs = Number.parseInt(tsHeader, 10);
    if (!Number.isFinite(parsedTs)) {
      throw new HttpException(
        'Invalid X-Client-Timestamp',
        HttpStatus.BAD_REQUEST,
      );
    }

    const clientMs = parsedTs < 1e12 ? parsedTs * 1000 : parsedTs;
    const now = Date.now();
    if (Math.abs(now - clientMs) > skewMs) {
      throw new HttpException(
        'Request timestamp outside allowed window',
        HttpStatus.BAD_REQUEST,
      );
    }

    const scope = await this.resolveScope(req);
    let firstUse: boolean;
    try {
      firstUse = await this.replay.checkAndRemember(scope, nonceHeader);
    } catch {
      throw new HttpException(
        'Anti-replay service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (!firstUse) {
      throw new HttpException(
        'Duplicate request (replay detected)',
        HttpStatus.CONFLICT,
      );
    }

    return true;
  }

  private async resolveScope(req: Request): Promise<string> {
    const ip = clientIp(req);
    const raw = req.headers.authorization;
    if (typeof raw !== 'string' || !raw.startsWith('Bearer ')) {
      return `ip:${ip}`;
    }
    const token = raw.slice(7).trim();
    if (!token) {
      return `ip:${ip}`;
    }
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: unknown }>(token);
      const sub = payload?.sub;
      if (typeof sub === 'string' && sub.length > 0) {
        return `u:${sub}`;
      }
    } catch {
      /* invalid or expired access token — bind replay bucket to IP */
    }
    return `ip:${ip}`;
  }
}

function clientIp(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string') {
    const first = xf.split(',')[0]?.trim();
    if (first) return first;
  } else if (Array.isArray(xf) && xf[0]) {
    return xf[0];
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}
