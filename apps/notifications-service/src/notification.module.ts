import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NotificationService } from './notification.service';
import { NotificationResolver } from './notification.resolver';
import { NotificationGateway } from './notification.gateway';
import { NotificationController } from './notification.controller';
import { Notification } from './notification.entity';
import { getNotificationsServicePostgresConfig } from '@app/database';
import { LoggerService, MetricsController, MonitoringModule } from '@app/common';
import { AuthModule } from '../../../libs/shared/src/auth';
import { NotificationRepository } from './notification.repository';

@Module({
  imports: [
    TypeOrmModule.forRoot(getNotificationsServicePostgresConfig() as any),
    TypeOrmModule.forFeature([Notification]),
    // GraphQL configuration
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: {
        federation: 2,
      },
      playground: true,
      introspection: true,
      context: ({ req }) => ({ req }),
    }),
    ClientsModule.register([
      {
        name: 'KAFKA_CLIENT',
        transport: Transport.KAFKA,
        options: {
          client: { 
            brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
            clientId: process.env.SERVICE_NAME || 'notifications-service',
          },
          producer: {
            allowAutoTopicCreation: true,
            idempotent: true,
            retry: {
              retries: 8,
              maxRetryTime: 30000,
            }
          },
        },
      },
    ]),
    AuthModule,
    MonitoringModule,
  ],
  controllers: [NotificationController, MetricsController],
  providers: [
    NotificationService, 
    NotificationResolver,
    NotificationGateway,
    NotificationRepository,
    LoggerService,
  ],
})
export class NotificationModule {}
