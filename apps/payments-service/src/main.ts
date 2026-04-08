import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { PaymentModule } from './payment.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Partitioners } from 'kafkajs';
import { LoggerService } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create(PaymentModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        clientID: process.env.SEVER_NAME || 'payments-service',
        retry: {
          retries: 8,
          initialRetryTime: 1000,
          maxRetryTime: 5000,
          factor: 2,          
        },
      },
      consumer: {
        groupId: 'payments-service-consumer',
        allowAutoTopicCreation: true,
        sessionTimeout: 30000,
        rebalanceTimeout: 60000,
        heartbeatInterval: 3000,
      },
      producer: {
        createPartitioner: Partitioners.LegacyPartitioner,
      },
      run: {
        autoCommit: false,
      },
    },
  });

  const logger = app.get(LoggerService);

  // Enable CORS for WebSocket connections
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const port = process.env.PAYMENTS_SERVICE_PORT || 4004;
  await app.listen(port);

  logger.log(`🚀 Payments Service is running on: http://localhost:${port}`);
  logger.log(`📊 GraphQL Playground: http://localhost:${port}/graphql`);
  logger.log(`🔌 WebSocket Gateway: ws://localhost:${port}/payments`);
}
bootstrap();
