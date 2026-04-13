import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';
import { Logger } from '@nestjs/common';
import { LoggerService } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);
  const logger = app.get(LoggerService);

  // Enable CORS
  app.enableCors({
    origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = process.env.API_GATEWAY_PORT || 4000;
  await app.listen(port);

  logger.log(`🚀 API Gateway running on http://localhost:${port}`);
  logger.log(`📊 GraphQL Playground: http://localhost:${port}/graphql`);
  logger.log(`🔌 REST API: http://localhost:${port}/api/v1/:service/*`);
  logger.log(`❤️  Health Check: http://localhost:${port}/health`);
  logger.log(`📈 Service Status: http://localhost:${port}/health/services`);
}

bootstrap();
