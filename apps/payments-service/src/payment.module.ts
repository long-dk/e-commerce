import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphQLModule } from '@nestjs/graphql';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Payment } from './payment.entity';
import { PaymentService } from './payment.service';
import { PaymentResolver } from './payment.resolver';
import { PaymentGateway } from './payment.gateway';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { LoggerService } from '@app/common';
import { PaymentController } from './payment.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('PAYMENTS_DB_HOST', 'localhost'),
        port: configService.get('PAYMENTS_DB_PORT', 5432),
        username: configService.get('PAYMENTS_DB_USERNAME', 'ecommerce_user'),
        password: configService.get('PAYMENTS_DB_PASSWORD', 'ecommerce_password'),
        database: configService.get('PAYMENTS_DB_NAME', 'ecommerce_db'),
        entities: [Payment],
        synchronize: configService.get('NODE_ENV') !== 'production',
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Payment]),
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: {
        federation: 2,
      },
      playground: true,
      introspection: true,
      context: ({ req }) => ({ req }),
    }),
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_CLIENT',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              brokers: configService.get('KAFKA_BROKERS', 'localhost:9092').split(','),
              clientId: configService.get('SERVICE_NAME', 'payments-service'),
            },
            producer: {
              allowAutoTopicCreation: true, // Allow Kafka to create topics if they don't exist
              idempotent: true, // Ensure exactly-once delivery
              retry: {
                retries: 5,
                maxRetryTime: 30000,
              },
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    PaymentResolver,
    PaymentGateway,
    LoggerService,
  ],
})
export class PaymentModule {}
