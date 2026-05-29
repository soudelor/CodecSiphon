import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { resolveJwtSecret } from '../jwt-secret.util';

export type JwtAccessPayload = {
  sub: string;
  email: string;
  role: string;
  /** 用户站 `user`，管理端会话 `admin`；旧 token 无此字段时视为 `user` */
  aud?: 'user' | 'admin';
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(config),
    });
  }

  validate(payload: JwtAccessPayload) {
    const aud: 'user' | 'admin' = payload.aud === 'admin' ? 'admin' : 'user';
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      aud,
    };
  }
}
