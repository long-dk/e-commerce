import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Inventory, InventorySchema } from './inventory.entity';
import { StockMovement, StockMovementSchema } from './stock-movement.entity';
import { InventoryResolver } from './inventory.resolver';
import { InventoryService } from './inventory.service';
import { InventoryGateway } from './inventory.gateway';
import { InventoryKafkaService } from './inventory.kafka';
import { getMongoConfig } from '@app/database';
import { JwtModule } from '@nestjs/jwt';
import { LoggerService } from '@app/common';
import { InventoryController } from './inventory.controller';

@Module({
  imports: [
    // MongoDB connection for inventory data
    MongooseModule.forRoot(getMongoConfig().uri),
    MongooseModule.forFeature([
      { name: Inventory.name, schema: InventorySchema },
      { name: StockMovement.name, schema: StockMovementSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'jwt-secret-key',
      signOptions: {
        expiresIn: process.env.JWT_EXPIRATION || '3600s',
      },
    }),
    // GraphQL configuration
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
  ],
  controllers: [InventoryController],
  providers: [
    InventoryResolver,
    InventoryService,
    InventoryGateway,
    InventoryKafkaService,
    // PubSub for GraphQL subscriptions
    {
      provide: 'PUB_SUB',
      useValue: new (require('graphql-subscriptions').PubSub)(),
    },
    LoggerService,
  ],
  exports: [InventoryService, InventoryKafkaService],
})
export class InventoryModule {}