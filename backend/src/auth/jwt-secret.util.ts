import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const log = new Logger('JwtSecret');

/**
 * Resolves signing secret for access JWT.
 * In production, JWT_SECRET must be set. In other environments, a dev default is used with a warning.
 */
export function resolveJwtSecret(config: ConfigService): string {
  const raw = config.get<string>('JWT_SECRET') ?? process.env.JWT_SECRET;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (trimmed.length > 0) {
    return trimmed;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET is required in production. Set it in backend/.env or in the process environment.',
    );
  }

  log.warn(
    'JWT_SECRET is not set; using an insecure development default. Add JWT_SECRET to backend/.env.',
  );
  return 'codec-siphon-dev-jwt-secret-change-me-min-32-chars!';
}
