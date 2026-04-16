import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { InventoryModule } from './inventory.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Partitioners } from 'kafkajs';
import { LoggerService, TracingService, MetricsInterceptor } from '@app/common';

async function bootstrap() {
  // Initialize distributed tracing first
  await TracingService.initializeTracing(
    'inventory-service',
    process.env.JAEGER_ENDPOINT || 'http://localhost:4317',
  );

  const app = await NestFactory.create(InventoryModule);
  const metricsInterceptor = app.get(MetricsInterceptor);

  // Enable metrics interceptor globally
  app.useGlobalInterceptors(metricsInterceptor);

  // Enable CORS for GraphQL and WebSocket connections
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:4000', 'http://localhost:8080'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
        clientId: process.env.SERVICE_NAME || 'inventory-service',
        retry: {
          retries: 8,
          initialRetryTime: 1000,
          maxRetryTime: 5000,
          factor: 2,
        },
      },
      consumer: {
        groupId: 'inventory-service-consumer',
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
  
  const logger = app.get(LoggerService);
  
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
  // Start the application
  const port = process.env.INVENTORY_SERVICE_PORT || 4005;
  await app.listen(port);
  logger.log(`✅ Inventory Service is running on: http://localhost:${port}/graphql`);
  logger.log(`📊 Prometheus Metrics: http://localhost:${port}/metrics`);
  logger.log(`📡 WebSocket Gateway available at: ws://localhost:${port}/inventory`);
}

bootstrap();
