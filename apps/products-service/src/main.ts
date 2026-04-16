import { NestFactory } from '@nestjs/core';
import { ProductModule } from './product.module';
import { LoggerService, TracingService, MetricsInterceptor } from '@app/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Partitioners } from 'kafkajs';

async function bootstrap() {
  // Initialize distributed tracing first
  await TracingService.initializeTracing(
    'products-service',
    process.env.JAEGER_ENDPOINT || 'http://localhost:4317',
  );

  const app = await NestFactory.create(ProductModule);
  const logger = app.get(LoggerService);
  const metricsInterceptor = app.get(MetricsInterceptor);

  // Enable metrics interceptor globally
  app.useGlobalInterceptors(metricsInterceptor);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        clientId: process.env.SERVICE_NAME || 'products-service',
        retry: {
          retries: 8,
          initialRetryTime: 1000,
          maxRetryTime: 5000,
          factor: 2,
        },
      },
      consumer: {
        groupId: 'products-consumer-group',
        allowAutoTopicCreation: true,
        sessionTimeout: 30000,
        rebalanceTimeout: 60000,
        heartbeatInterval: 5000,
      },
      producer: {
        createPartitioner: Partitioners.DefaultPartitioner,
      },
      run: {
        autoCommit: false,
      },
    },
  });

  app.enableShutdownHooks();
  // Enable CORS for WebSocket connections
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  await app.startAllMicroservices();
  const port = process.env.PRODUCTS_SERVICE_PORT || 4002;
  await app.listen(port);
  logger.log(`✅ Products Service is running on port ${port}`);
  logger.log(`📊 Prometheus Metrics: http://localhost:${port}/metrics`);
  logger.log(`WebSocket gateway available at ws://localhost:${port}/products`);

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    logger.log(`Signal received: ${signal}, shutting down gracefully...`);
    await app.close();
    await TracingService.shutdown();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  console.error('Failed to start Products Service:', error);
  process.exit(1);
});
