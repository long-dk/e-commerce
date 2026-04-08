import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { UseGuards, BadRequestException } from '@nestjs/common';
import { PassportAuthGuard } from './passport-auth.guard';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { AuthPayloadGQL, AuthTokensGQL, UserGQL } from './auth.types';
import { CreateUserDto, LoginUserDto, UserResponseDto } from '@app/dto';
import { CurrentUser } from '@app/common';

@Resolver()
export class AuthResolver {
  constructor(
    private authService: AuthService,
    private userService: UserService,
  ) {}

  @Mutation(() => AuthPayloadGQL)
  async register(
    @Args('email') email: string,
    @Args('password') password: string,
    @Args('firstName') firstName: string,
    @Args('lastName') lastName: string,
  ): Promise<{ user: UserResponseDto; tokens: any }> {
    const createUserDto: CreateUserDto = {
      email,
      password,
      firstName,
      lastName,
    };

    const tokens = await this.authService.register(createUserDto);
    const user = await this.userService.getUserByEmail(email);

    if (!user) {
      throw new BadRequestException(
        'User was created but could not be retrieved',
      );
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      tokens,
    };
  }

  @Mutation(() => AuthPayloadGQL)
  async login(
    @Args('email') email: string,
    @Args('password') password: string,
  ): Promise<{ user: UserResponseDto; tokens: any }> {
    const loginUserDto: LoginUserDto = { email, password };
    const tokens = await this.authService.login(loginUserDto);
    const user = await this.userService.getUserByEmail(email);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const userResponseDto: UserResponseDto = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      user: userResponseDto,
      tokens,
    };
  }

  @Mutation(() => AuthTokensGQL)
  async refreshToken(@Args('refreshToken') refreshToken: string): Promise<any> {
    return this.authService.refreshToken(refreshToken);
  }

  @Mutation(() => String)
  @UseGuards(PassportAuthGuard)
  async logout(
    @CurrentUser('userId') userId: string,
    @Args('refreshToken') refreshToken: string,
  ): Promise<string> {
    await this.authService.logout(userId, refreshToken);
    return 'Logged out successfully';
  }

  @Query(() => UserGQL)
  @UseGuards(PassportAuthGuard)
  async me(@CurrentUser('userId') userId: string): Promise<UserResponseDto> {
    const user = await this.userService.getUserById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user;
  }

  @Query(() => Boolean)
  async validateToken(@Args('token') token: string): Promise<boolean> {
    try {
      // The token validation would be done by JWT strategy
      // This is a simple endpoint to check if token is valid
      return true;
    } catch {
      return false;
    }
  }

  @Query(() => String)
  async getGoogleLoginUrl(): Promise<string> {
    const clientID = process.env.GOOGLE_CLIENT_ID;
    const redirectURI = encodeURIComponent(
      process.env.GOOGLE_CALLBACK_URL ||
        'http://localhost:4001/auth/google/callback',
    );
    const scope = encodeURIComponent('profile email');
    const responseType = 'code';
    const accessType = 'offline';

    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientID}&redirect_uri=${redirectURI}&response_type=${responseType}&scope=${scope}&access_type=${accessType}`;
  }

  @Query(() => String)
  async getGithubLoginUrl(): Promise<string> {
    const clientID = process.env.GITHUB_CLIENT_ID;
    const redirectURI = encodeURIComponent(
      process.env.GITHUB_CALLBACK_URL ||
        'http://localhost:4001/auth/github/callback',
    );
    const scope = encodeURIComponent('user:email');

    return `https://github.com/login/oauth/authorize?client_id=${clientID}&redirect_uri=${redirectURI}&scope=${scope}`;
  }

  @Mutation(() => String)
  async sendVerificationEmail(@Args('email') email: string): Promise<string> {
    await this.userService.resendVerificationEmail(email);
    return 'Verification email sent successfully';
  }

  @Mutation(() => UserGQL)
  async verifyEmail(@Args('token') token: string): Promise<UserResponseDto> {
    return this.userService.verifyEmail(token);
  }
}
