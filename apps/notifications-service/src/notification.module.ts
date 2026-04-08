import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NotificationService } from './notification.service';
import { NotificationResolver } from './notification.resolver';
import { NotificationGateway } from './notification.gateway';
import { NotificationController } from './notification.controller';
import { Notification } from './notification.entity';
import { getPostgresConfig } from '@app/database';
import { LoggerService } from '@app/common';

@Module({
  imports: [
    TypeOrmModule.forRoot(getPostgresConfig() as any),
    TypeOrmModule.forFeature([Notification]),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      subscriptions: {
        'graphql-ws': true,
        'subscriptions-transport-ws': true,
      },
      playground: true,
      introspection: true,
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
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService, 
    NotificationResolver,
    NotificationGateway,
    // PubSub for GraphQL subscriptions
    {
      provide: 'PUB_SUB',
      useValue: new (require('graphql-subscriptions').PubSub)(),
    },
    LoggerService,
  ],
})
export class NotificationModule {}
