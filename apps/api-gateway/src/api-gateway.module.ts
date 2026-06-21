import { IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';
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
import { LoggerService, MetricsController, MonitoringModule } from '@app/common';
import { RegistryModule } from './registry.module';

@Module({
  imports: [
    RegistryModule,
    MonitoringModule,
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
        server: {
          // CORS configuration
          cors: {
            origin: (configService.get('ALLOWED_ORIGINS') || 'http://localhost:3000').split(','),
            credentials: true,
            methods: ['GET', 'POST', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
          },
          // Extract client headers and inject them into the GraphQL context
          context: async ({ req, res }) => {
            return {
              clientHeaders: req.headers,
            };
          },
          // Introspection and playground in development
          introspection: configService.get('NODE_ENV') !== 'production',
          playground: configService.get('NODE_ENV') !== 'production',
        },
        gateway: {
          supergraphSdl: new IntrospectAndCompose({
            subgraphs: serviceRegistry.getSubgraphs(),
            pollIntervalInMs: 10000, // Poll for schema changes every 10 seconds
          }),
          // Custom service builder to inject headers into subgraph HTTP requests
          buildService({ url }) {
            return new RemoteGraphQLDataSource({
              url,
              willSendRequest({ request, context }) {
                const headers = context.clientHeaders;
                // Forward client headers to subgraphs
                if (headers) {
                  Object.entries(headers).forEach(([key, value]) => {
                    request.http?.headers.set(key, value as string);
                  });
                }
                // Add custom header to identify requests from the gateway
                request.http?.headers.set('X-Forwarded-By', 'api-gateway');
              },
            });
          }
        },
        // Enable subscriptions for real-time features
        // subscriptions: {
        //   'graphql-ws': {
        //     useValue: {
        //       connectionInitWaitTimeout: 5000,
        //     },
        //   },
        // },
      }),
      inject: [ConfigService, ServiceRegistry],
    }),
  ],
  controllers: [GatewayController, HealthController, MetricsController],
  providers: [ServiceRegistry, ProxyService, LoggerService],
})
export class ApiGatewayModule {}
