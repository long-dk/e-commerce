import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { User } from './user.entity';
import { RefreshToken } from './refresh-token.entity';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { AuthResolver } from './auth.resolver';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './google.strategy';
import { GithubStrategy } from './github.strategy';
import { EmailService } from './email.service';
import { getAuthServicePostgresConfig } from '@app/database';
import { LoggerService } from '@app/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot(getAuthServicePostgresConfig() as any),
    TypeOrmModule.forFeature([User, RefreshToken]),
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: {
        federation: 2,
      },
      playground: true,
      introspection: true,
      context: ({ req }) => ({ req }),
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'jwt-secret-key',
      signOptions: {
        expiresIn: process.env.JWT_EXPIRATION || '3600s',
      },
    }),
    ClientsModule.register([
      {
        name: 'KAFKA_CLIENT',
        transport: Transport.KAFKA,
        options: {
          client: {
            brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
            clientId: process.env.SERVICE_NAME || 'auth-service',
          },
          producer: {
            allowAutoTopicCreation: true, // Enable auto topic creation for Kafka producer
            idempotent: true, // Enable idempotent producer to avoid duplicate messages
            retry: {
              retries: 5,
              maxRetryTime: 30000,
            },
          },
        },
      },
    ]),
    PassportModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    UserService,
    AuthResolver,
    JwtStrategy,
    GoogleStrategy,
    GithubStrategy,
    EmailService,
    LoggerService,
  ],
})
export class AuthServiceModule {}
