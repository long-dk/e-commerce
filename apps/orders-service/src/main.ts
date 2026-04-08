import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { OrderModule } from './order.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Partitioners } from 'kafkajs';
import { LoggerService } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create(OrderModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
        clientId: process.env.SERVICE_NAME || 'orders-service',
        retry: {
          retries: 8,
          factor: 2,
          initialRetryTime: 1000,
          maxRetryTime: 5000,
        },
      },
      consumer: {
        groupId: 'orders-service-consumer',
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

  // Enable CORS for GraphQL and WebSocket connections
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Enable global validation pipes
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const port = process.env.ORDERS_SERVICE_PORT || 4003;
  await app.listen(port);

  logger.log(`🚀 Orders Service is running on: http://localhost:${port}`);
  logger.log(`📊 GraphQL Playground: http://localhost:${port}/graphql`);
  logger.log(`🔌 WebSocket Gateway: ws://localhost:${port}/orders`);
}
bootstrap();
