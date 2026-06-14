import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'jwt-secret-key',
    });
  }

  async validate(payload: any) {
    // Return user object with userId and email from token payload
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
