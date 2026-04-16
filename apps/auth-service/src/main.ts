import { NestFactory } from '@nestjs/core';
import { AuthServiceModule } from './auth.module';
import { LoggerService, TracingService, MetricsInterceptor, PrometheusMetricsService } from '@app/common';

async function bootstrap() {
  // Initialize distributed tracing first
  await TracingService.initializeTracing(
    'auth-service',
    process.env.JAEGER_ENDPOINT || 'http://localhost:4317',
  );

  const app = await NestFactory.create(AuthServiceModule);
  const logger = app.get(LoggerService);
  const metricsInterceptor = app.get(MetricsInterceptor);

  // Enable metrics interceptor globally
  app.useGlobalInterceptors(metricsInterceptor);

  const port = process.env.AUTH_SERVICE_PORT || 4001;
  await app.listen(port);
  logger.log(`✅ Auth Service is running on port ${port}`);
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

bootstrap().catch((error) => {
  console.error('Failed to start Auth Service:', error);
  process.exit(1);
});
