import { IntrospectAndCompose } from '@apollo/gateway';
import { ApolloGatewayDriver, ApolloGatewayDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    GraphQLModule.forRootAsync<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      useFactory: async (configService: ConfigService) => ({
        gateway: {
          supergraphSdl: new IntrospectAndCompose({
            subgraphs: [
              {
                name: 'auth',
                url: configService.getOrThrow('AUTH_SERVICE_API'),
              },
              {
                name: 'products',
                url: configService.getOrThrow('PRODUCTS_SERVICE_API'),
              },
              {
                name: 'orders',
                url: configService.getOrThrow('ORDERS_SERVICE_API'),
              },
              {
                name: 'payments',
                url: configService.getOrThrow('PAYMENTS_SERVICE_API'),
              },
              // {
              //   name: 'inventory',
              //   url: configService.getOrThrow('INVENTORY_SERVICE_API'),
              // },
              // {
              //   name: 'shipping',
              //   url: configService.getOrThrow('SHIPPING_SERVICE_API'),
              // },
              // {
              //   name: 'notifications',
              //   url: configService.getOrThrow('NOTIFICATIONS_SERVICE_API'),
              // },
            ],
          }),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [],
  providers: [],
})
export class ApiGatewayModule {}
