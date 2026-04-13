import { IntrospectAndCompose } from '@apollo/gateway';
import { ApolloGatewayDriver, ApolloGatewayDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ThrottlerModule } from '@nestjs/throttler';
import { HttpModule } from '@nestjs/axios';
import { ServiceRegistry } from './service-registry';
import { GatewayController } from './gateway.controller';
import { HealthController } from './health.controller';
import { ProxyService } from './proxy.service';
import { LoggerService } from '@app/common';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Rate limiting: 100 requests per 15 minutes per IP
    ThrottlerModule.forRoot([
      {
        ttl: 900000, // 15 minutes
        limit: 100,
      },
    ]),
    HttpModule,
    GraphQLModule.forRootAsync<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      useFactory: async (configService: ConfigService, serviceRegistry: ServiceRegistry) => ({
        gateway: {
          supergraphSdl: new IntrospectAndCompose({
            subgraphs: serviceRegistry.getSubgraphs(),
            pollIntervalInMs: 10000, // Poll for schema changes every 10 seconds
          }),
        },
        // Enable subscriptions for real-time features
        subscriptions: {
          'graphql-ws': {
            useValue: {
              connectionInitWaitTimeout: 5000,
            },
          },
        },
        // Introspection and playground in development
        introspection: configService.get('NODE_ENV') !== 'production',
        playground: configService.get('NODE_ENV') !== 'production',
        // CORS configuration
        cors: {
          origin: (configService.get('ALLOWED_ORIGINS') || 'http://localhost:3000').split(','),
          credentials: true,
          methods: ['GET', 'POST', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization'],
        },
        // Context builder for authentication
        context: async ({ req, res }) => {
          return {
            authorization: req.headers.authorization,
            request: req,
            response: res,
          };
        },
      }),
      inject: [ConfigService, ServiceRegistry],
    }),
  ],
  controllers: [GatewayController, HealthController],
  providers: [ServiceRegistry, ProxyService, LoggerService],
})
export class ApiGatewayModule {}
