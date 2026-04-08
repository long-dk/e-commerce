import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { ConfigModule } from '@nestjs/config';
import { ProductService } from './product.service';
import { ProductResolver } from './product.resolver';
import { ProductGateway } from './product.gateway';
import { Product, ProductSchema } from './product.schema';
import { getMongoConfig } from '@app/database';
import { LoggerService } from '@app/common';
import { ProductController } from './product.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { retry } from 'rxjs';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRoot(getMongoConfig().uri),
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
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
            clientId: process.env.SERVICE_NAME || 'products-service',
            brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
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
  controllers: [ProductController],
  providers: [
    ProductService,
    ProductResolver,
    ProductGateway,
    LoggerService,
    {
      provide: 'PUB_SUB',
      useValue: new (require('graphql-subscriptions').PubSub)(),
    }
  ],
})
export class ProductModule {}
