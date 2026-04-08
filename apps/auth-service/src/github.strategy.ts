import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-github2';
import { UserService } from './user.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private userService: UserService) {
    super({
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL:
        process.env.GITHUB_CALLBACK_URL ||
        'http://localhost:4001/auth/github/callback',
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const { id, username, displayName, emails, avatar_url } = profile;

      const firstName = displayName?.split(' ')[0] || username || '';
      const lastName = displayName?.split(' ')[1] || '';
      const email = emails?.[0]?.value || `${username}@github.local`;

      // Find or create user with GitHub ID
      let user = await this.userService.findOrCreateOAuthUser({
        email,
        githubId: id.toString(),
        firstName,
        lastName,
      } as any);

      if (!user) {
        // Create new user with OAuth
        user = await this.userService.findOrCreateOAuthUser({
          email,
          firstName,
          lastName,
          googleId: id.toString(),
        });
      }

      return done(null, user);
    } catch (error) {
      done(error);
    }
  }
}
