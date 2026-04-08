import { NestFactory } from '@nestjs/core';
import { ShippingModule } from './shipping.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Partitioners } from 'kafkajs';

async function bootstrap() {
  const app = await NestFactory.create(ShippingModule);
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
  await app.listen(process.env.SHIPPING_SERVICE_PORT || 4006);
}
bootstrap();
