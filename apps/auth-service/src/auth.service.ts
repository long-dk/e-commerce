import { Injectable, UnauthorizedException, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from './user.service';
import { RefreshToken } from './refresh-token.entity';
import { User } from './user.entity';
import { CreateUserDto, LoginUserDto, TokenResponseDto } from '@app/dto';
import { UserRegisteredEvent } from '@app/kafka';
import { ClientKafka } from '@nestjs/microservices';
import { LoggerService } from '@app/common';

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    @Inject('KAFKA_CLIENT') private kafkaClient: ClientKafka,
    private logger: LoggerService,
  ) {}

  async onModuleInit() {
    // Subscribe to Kafka topics if needed
    this.kafkaClient.subscribeToResponseOf('user-registered');
    await this.kafkaClient.connect();
  }

  async onModuleDestroy() {
    await this.kafkaClient.close();
  }

  async register(createUserDto: CreateUserDto): Promise<TokenResponseDto> {
    // Create user
    const userDto = await this.userService.createUser(createUserDto);

    // Send verification email
    try {
      await this.userService.sendVerificationEmail(userDto.id);
    } catch (error) {
      // Log error but don't fail registration
      this.logger.error('Failed to send verification email:', error);
    }

    // Generate tokens
    const tokens = await this.generateTokens(userDto.id);

    // Publish user-registered event
    await this.publishUserRegisteredEvent({
      userId: userDto.id,
      email: userDto.email,
      firstName: userDto.firstName,
      lastName: userDto.lastName,
      createdAt: userDto.createdAt,
    });

    return tokens;
  }

  async login(loginUserDto: LoginUserDto): Promise<TokenResponseDto> {
    const { email, password } = loginUserDto;

    // Find user
    const user = await this.userService.getUserByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Validate password
    const isPasswordValid = await this.userService.validatePassword(
      password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.userService.updateLastLogin(user.id);

    // Generate tokens
    return this.generateTokens(user.id);
  }

  async refreshToken(refreshToken: string): Promise<TokenResponseDto> {
    try {
      const decoded = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      });

      // Check if token is revoked
      const token = await this.refreshTokenRepository.findOne({
        where: { token: refreshToken },
      });

      if (!token || token.isRevoked || new Date() > token.expiresAt) {
        throw new UnauthorizedException('Refresh token is invalid or expired');
      }

      // Generate new tokens
      return this.generateTokens(decoded.sub);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateUser(userId: string): Promise<User | null> {
    return this.userService.getUserByEmail(userId) || null;
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    // Revoke refresh token
    await this.refreshTokenRepository.update(
      { token: refreshToken },
      { isRevoked: true },
    );
  }

  async generateTokens(userId: string): Promise<TokenResponseDto> {
    const expiresIn = process.env.JWT_EXPIRATION || '3600s';
    const expiresInSeconds = this.parseExpirationTime(expiresIn);

    // Generate access token
    const accessToken = this.jwtService.sign(
      { sub: userId },
      {
        expiresIn: expiresInSeconds,
        secret: process.env.JWT_SECRET,
      },
    );

    // Generate refresh token
    const refreshTokenString = this.jwtService.sign(
      { sub: userId },
      {
        expiresIn: '7d',
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      },
    );

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const refreshToken = this.refreshTokenRepository.create({
      userId,
      token: refreshTokenString,
      expiresAt,
    });

    await this.refreshTokenRepository.save(refreshToken);

    return {
      accessToken,
      refreshToken: refreshTokenString,
      expiresIn: expiresInSeconds,
    };
  }

  private parseExpirationTime(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 3600; // Default 1 hour

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 3600;
    }
  }

  private async publishUserRegisteredEvent(
    event: UserRegisteredEvent,
  ): Promise<void> {
    try {
      this.kafkaClient.emit('user-registered', {
        userId: event.userId,
        email: event.email,
        firstName: event.firstName,
        lastName: event.lastName,
        createdAt: event.createdAt,
      });
      this.logger.log('Published user-registered event');
    } catch (error) {
      this.logger.error('Failed to publish user-registered event', error);
      // Don't fail registration if Kafka is down
    }
  }

  getHello(): string {
    return 'Hello World!';
  }
}
