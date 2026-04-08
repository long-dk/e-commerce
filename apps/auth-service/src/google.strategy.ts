import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { UserService } from './user.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private userService: UserService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        'http://localhost:4001/auth/google/callback',
      scope: ['profile', 'email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const { id, displayName, emails, photos } = profile;

      const firstName = displayName?.split(' ')[0] || '';
      const lastName = displayName?.split(' ')[1] || '';
      const email = emails?.[0]?.value || '';
      const profilePhoto = photos?.[0]?.value || '';

      // Find or create user with Google ID
      let user = await this.userService.findOrCreateOAuthUser({
        email,
        googleId: id,
        firstName,
        lastName,
      } as any);

      if (!user) {
        // Create new user with OAuth
        user = await this.userService.findOrCreateOAuthUser({
          email,
          firstName,
          lastName,
          googleId: id,
        });
      }

      return done(null, user);
    } catch (error) {
      done(error);
    }
  }
}
