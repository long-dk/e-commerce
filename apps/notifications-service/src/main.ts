import { NestFactory } from '@nestjs/core';
import { NotificationModule } from './notification.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Partitioners } from 'kafkajs';
import { LoggerService, TracingService, MetricsInterceptor } from '@app/common';

async function bootstrap() {
  // Initialize distributed tracing first
  await TracingService.initializeTracing(
    'notifications-service',
    process.env.JAEGER_ENDPOINT || 'http://localhost:4317',
  );

  const app = await NestFactory.create(NotificationModule);
  const metricsInterceptor = app.get(MetricsInterceptor);
  const logger = app.get(LoggerService);

  // Enable metrics interceptor globally
  app.useGlobalInterceptors(metricsInterceptor);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
        clientId: process.env.SERVICE_NAME || 'notifications-service',
        retry: {
          retries: 8,
          initialRetryTime: 1000,
          maxRetryTime: 5000,
          factor: 2,
        },
      },
      consumer: {
        groupId: 'notifications-service-consumer',
        allowAutoTopicCreation: true,
        sessionTimeout: 30000,
        rebalanceTimeout: 60000,
        heartbeatInterval: 5000,
      },
      producer: {
        createPartitioner: Partitioners.LegacyPartitioner
      },
      run: {
        autoCommit: false,
      },
    },
  });

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
  const port = process.env.NOTIFICATIONS_SERVICE_PORT || 4007;
  await app.listen(port);
  logger.log(`✅ Notifications Service is running on port ${port}`);
  logger.log(`📊 Prometheus Metrics: http://localhost:${port}/metrics`);
}
bootstrap();
