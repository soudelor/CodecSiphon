import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

/** 要求 JWT 已通过校验，且 `aud === admin` 且 `role === admin`。 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const u = req.user;
    if (!u) {
      return false;
    }
    if (u.aud !== 'admin' || u.role !== 'admin') {
      throw new ForbiddenException();
    }
    return true;
  }
}
