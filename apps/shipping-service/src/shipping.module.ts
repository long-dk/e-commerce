import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Shipment } from './shipping.entity';
import { ShippingResolver } from './shipping.resolver';
import { ShippingService } from './shipping.service';
import { ShippingGateway } from './shipping.gateway';
import { ShippingKafkaService } from './shipping.kafka';
import { JwtModule } from '@nestjs/jwt';
import { LoggerService } from '@app/common';
import { retry } from 'rxjs';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: Number(process.env.DATABASE_PORT) || 5432,
      username: process.env.DATABASE_USER || 'ecommerce_user',
      password: process.env.DATABASE_PASSWORD || 'ecommerce_password',
      database: process.env.DATABASE_NAME || 'ecommerce_db',
      entities: [Shipment],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Shipment]),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      subscriptions: {
        'graphql-ws': true,
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
            clientId: process.env.SERVICE_NAME || 'shipping-service',
          },
          producer: {
            allowAutoTopicCreation: true,
            idempotent: true, // Ensure exactly-once delivery
            retry: {
              retries: 5,
              maxRetryTime: 30000,
            },
          },
        },
      },
    ]),
     JwtModule.register({
      secret: process.env.JWT_SECRET || 'jwt-secret-key',
      signOptions: {
        expiresIn: process.env.JWT_EXPIRATION || '3600s',
      },
    }),
  ],
  providers: [
    ShippingResolver,
    ShippingService,
    ShippingGateway,
    ShippingKafkaService,
    LoggerService,
    {
      provide: 'PUB_SUB',
      useValue: new (require('graphql-subscriptions').PubSub)(),
    },
  ],
  exports: [ShippingService, ShippingKafkaService],
})
export class ShippingModule {}
