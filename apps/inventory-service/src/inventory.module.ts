import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Inventory, InventorySchema } from './inventory.entity';
import { StockMovement, StockMovementSchema } from './stock-movement.entity';
import { InventoryResolver } from './inventory.resolver';
import { InventoryService } from './inventory.service';
import { InventoryGateway } from './inventory.gateway';
import { InventoryKafkaService } from './inventory.kafka';
import { getInventoryServiceMongoConfig } from '@app/database';
import { LoggerService, MetricsController, MonitoringModule } from '@app/common';
import { InventoryController } from './inventory.controller';
import { AuthModule } from '../../../libs/shared/src/auth';
import { InventoryRepository } from './inventory.repository';

@Module({
  imports: [
    // MongoDB connection for inventory data
    MongooseModule.forRoot(getInventoryServiceMongoConfig().uri),
    MongooseModule.forFeature([
      { name: Inventory.name, schema: InventorySchema },
      { name: StockMovement.name, schema: StockMovementSchema },
    ]),
    AuthModule,
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
    // Kafka client for event-driven communication
    ClientsModule.register([
      {
        name: 'KAFKA_CLIENT',
        transport: Transport.KAFKA,
        options: {
          client: {
            brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
            clientId: process.env.SERVICE_NAME || 'inventory-service',
          },
          producer: {
            allowAutoTopicCreation: true,
            idempotent: true,
            retry: {
              retries: 5,
              maxRetryTime: 30000,
            },
          },
        },
      },
    ]),
    MonitoringModule,
  ],
  controllers: [InventoryController, MetricsController],
  providers: [
    InventoryResolver,
    InventoryService,
    InventoryGateway,
    InventoryKafkaService,
    InventoryRepository,
    LoggerService,
  ],
  exports: [InventoryService, InventoryKafkaService],
})
export class InventoryModule {}