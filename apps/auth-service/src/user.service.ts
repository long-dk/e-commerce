import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from './user.entity';
import { CreateUserDto, UserResponseDto, UserRole } from '@app/dto';
import { EmailService } from './email.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private emailService: EmailService,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const { email, password, firstName, lastName, role } = createUserDto;

    // Check if user exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: role || UserRole.USER,
      isEmailVerified: false,
    });

    const savedUser = await this.userRepository.save(user);
    return this.toUserResponseDto(savedUser);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async getUserById(id: string): Promise<UserResponseDto | null> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) return null;
    return this.toUserResponseDto(user);
  }

  async validatePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userRepository.update(userId, { lastLogin: new Date() });
  }

  async updateUser(
    userId: string,
    updates: Partial<User>,
  ): Promise<UserResponseDto> {
    await this.userRepository.update(userId, updates);
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toUserResponseDto(user);
  }

  async findOrCreateOAuthUser(
    createUserDto: Partial<CreateUserDto> & { googleId?: string; githubId?: string },
  ): Promise<User> {
    const { email, firstName = '', lastName = '', googleId, githubId } = createUserDto;
    let user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      user = this.userRepository.create({
        email,
        firstName: firstName || '',
        lastName: lastName || '',
        password: Buffer.from(Math.random().toString()).toString('base64'), // Random password for OAuth
        role: UserRole.USER,
        isEmailVerified: true, // OAuth users have verified email
        googleId,
        githubId,
      });
      user = await this.userRepository.save(user);
    } else {
      // Update OAuth IDs if provided
      if (googleId && !user.googleId) {
        user.googleId = googleId;
      }
      if (githubId && !user.githubId) {
        user.githubId = githubId;
      }
      if (googleId || githubId) {
        user = await this.userRepository.save(user);
      }
    }

    return user;
  }

  async generateEmailVerificationToken(userId: string): Promise<string> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Generate random token
    const token = crypto.randomBytes(32).toString('hex');

    // Set expiration to 24 hours from now
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);

    // Update user with verification token
    await this.userRepository.update(userId, {
      emailVerificationToken: token,
      emailVerificationExpires: expires,
    });

    return token;
  }

  async sendVerificationEmail(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    const token = await this.generateEmailVerificationToken(userId);
    await this.emailService.sendVerificationEmail(user.email, token);
  }

  async verifyEmail(token: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    if (
      !user.emailVerificationExpires ||
      user.emailVerificationExpires < new Date()
    ) {
      throw new BadRequestException('Verification token has expired');
    }

    // Mark email as verified and clear verification data
    await this.userRepository.update(user.id, {
      isEmailVerified: true,
      emailVerificationToken: undefined,
      emailVerificationExpires: undefined,
    });

    return this.toUserResponseDto(user);
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Check if there's an existing token and if it's still valid
    if (
      user.emailVerificationToken &&
      user.emailVerificationExpires &&
      user.emailVerificationExpires > new Date()
    ) {
      // Resend existing token
      await this.emailService.sendVerificationEmail(
        user.email,
        user.emailVerificationToken,
      );
    } else {
      // Generate new token
      await this.sendVerificationEmail(user.id);
    }
  }

  private toUserResponseDto(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
