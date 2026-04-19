import { NestFactory } from '@nestjs/core';
import { ShippingModule } from './shipping.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Partitioners } from 'kafkajs';
import { LoggerService, TracingService, MetricsInterceptor } from '@app/common';

async function bootstrap() {
  // Initialize distributed tracing first
  await TracingService.initializeTracing(
    'shipping-service',
    process.env.JAEGER_ENDPOINT || 'http://localhost:4317',
  );

  const app = await NestFactory.create(ShippingModule);
  const metricsInterceptor = app.get(MetricsInterceptor);
  const logger = app.get(LoggerService);

  // Enable metrics interceptor globally
  app.useGlobalInterceptors(metricsInterceptor);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        clientId: process.env.SERVICE_NAME || 'shipping-service',
        retry: {
          initialRetryTime: 1000,
          maxRetryTime: 5000,
          factor: 2,
          retries: 8,
        },
      },
      consumer: {
        groupId: 'shipping-consumer-group',
        allowAutoTopicCreation: true,
        sessionTimeout: 30000,
        rebalanceTimeout: 60000,
        heartbeatInterval: 5000,
      },
      producer: {
        createPartitioner: Partitioners.LegacyPartitioner,
      },
      run: {
        autoCommit: false,
      },
    },
  });
  
  app.enableShutdownHooks();

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    logger.log(`Signal received: ${signal}, shutting down gracefully...`);
    await app.close();
    await TracingService.shutdown();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await app.startAllMicroservices();
  const port = process.env.SHIPPING_SERVICE_PORT || 4006;
  await app.listen(port);
  logger.log(`✅ Shipping Service is running on port ${port}`);
  logger.log(`📊 Prometheus Metrics: http://localhost:${port}/metrics`);
}
bootstrap();
