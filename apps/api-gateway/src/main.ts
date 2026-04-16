import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';
import { LoggerService, TracingService, MetricsInterceptor, PrometheusMetricsService } from '@app/common';

async function bootstrap() {
  // Initialize distributed tracing first
  await TracingService.initializeTracing(
    'api-gateway',
    process.env.JAEGER_ENDPOINT || 'http://localhost:4317',
  );

  const app = await NestFactory.create(ApiGatewayModule);
  const logger = app.get(LoggerService);
  const metricsService = app.get(PrometheusMetricsService);
  const metricsInterceptor = app.get(MetricsInterceptor);

  // Enable metrics interceptor globally
  app.useGlobalInterceptors(metricsInterceptor);

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
  logger.log(`📊 Prometheus Metrics: http://localhost:${port}/metrics`);

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

bootstrap();
