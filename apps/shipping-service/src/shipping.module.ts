import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Shipment } from './shipping.entity';
import { ShippingResolver } from './shipping.resolver';
import { ShippingService } from './shipping.service';
import { ShippingGateway } from './shipping.gateway';
import { ShippingKafkaService } from './shipping.kafka';
import { getShippingServicePostgresConfig } from '@app/database';
import { LoggerService, MetricsController, MonitoringModule } from '@app/common';
import { AuthModule } from '../../../libs/shared/src/auth';
import { ShippingController } from './shipping.controller';
import { ShippingRepository } from './shipping.repository'

@Module({
  imports: [
    TypeOrmModule.forRoot(getShippingServicePostgresConfig() as any),
    TypeOrmModule.forFeature([Shipment]),
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
    AuthModule,
    MonitoringModule,
  ],
  controllers: [ShippingController, MetricsController],
  providers: [
    ShippingResolver,
    ShippingService,
    ShippingGateway,
    ShippingKafkaService,
    LoggerService,
    ShippingRepository,
  ],
  exports: [ShippingService, ShippingKafkaService],
})
export class ShippingModule {}
