import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  /** JWT `aud`：用户站为 `user`，管理端会话为 `admin` */
  aud?: 'user' | 'admin';
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.user as AuthUser;
  },
);
