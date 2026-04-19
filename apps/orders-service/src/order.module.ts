import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphQLModule } from '@nestjs/graphql';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OrderController } from './order.controller';
import { OrderResolver } from './order.resolver';
import { OrderService } from './order.service';
import { OrderGateway } from './order.gateway';
import { Order, OrderItem } from './order.entity';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { GraphQLJSONObject } from 'graphql-type-json';
import { getOrdersServicePostgresConfig } from '@app/database';
import { LoggerService, MonitoringModule } from '@app/common';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot(getOrdersServicePostgresConfig() as any),
    TypeOrmModule.forFeature([Order, OrderItem]),
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: {
        federation: 2,
      },
      playground: true,
      introspection: true,
      context: ({ req }) => ({ req }),
      resolvers: {
        JSONObject: GraphQLJSONObject,
      },
    }),
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_CLIENT',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              brokers: [configService.get('KAFKA_BROKERS', 'localhost:9092')],
              clientId: configService.get('SERVICE_NAME', 'orders-service'),
            },
            producer: {
              allowAutoTopicCreation: true,
              idempotent: true,
              retry: {
                retries: 5,
                maxRetryTime: 30000,
              }
            }          
          },
        }),
        inject: [ConfigService],
      },
    ]),
    MonitoringModule,
  ],
  controllers: [OrderController],
  providers: [
    OrderResolver,
    OrderService,
    OrderGateway,
    LoggerService,
  ],
})
export class OrderModule {}
