import { NestFactory } from '@nestjs/core';
import { ProductModule } from './product.module';
import { LoggerService } from '@app/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Partitioners } from 'kafkajs';

async function bootstrap() {
  const app = await NestFactory.create(ProductModule);
  const logger = app.get(LoggerService);

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

  const port = process.env.PRODUCTS_SERVICE_PORT || 4002;

  await app.listen(port);
  logger.log(`Products Service is running on port ${port}`);
  logger.log(`WebSocket gateway available at ws://localhost:${port}/products`);
}

bootstrap().catch((error) => {
  console.error('Failed to start Products Service:', error);
  process.exit(1);
});
