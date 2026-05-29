import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../decorators/current-user.decorator';

/**
 * 拒绝 `aud: admin` 的 JWT 访问「用户站」业务接口（ADMIN_MODULE A-05）。
 */
@Injectable()
export class UserAudienceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as AuthUser | undefined;
    if (user?.aud === 'admin') {
      throw new ForbiddenException();
    }
    return true;
  }
}
