import { Global, Module, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { PrometheusMetricsService } from './prometheus-metrics.service';
import { BusinessMetricsService } from './business-metrics.service';
import { MetricsInterceptor } from './metrics.interceptor';
import { TracingService } from './tracing.service';
import { LoggerService } from './logger.service';

/**
 * Global Monitoring Module
 * 
 * This module provides comprehensive monitoring and observability:
 * - Prometheus metrics collection (HTTP, DB, custom business metrics)
 * - OpenTelemetry distributed tracing with Jaeger exporter
 * - Business metrics tracking (orders, payments, inventory, notifications)
 * - Automatic HTTP request metrics via interceptor
 * 
 * Usage in a NestJS service:
 *
 * 1. Import in your module:
 * @Module({
 *   imports: [MonitoringModule],
 *   controllers: [MyController],
 * })
 * export class MyModule {}
 *
 * 2. Use in your service:
 * @Injectable()
 * export class MyService {
 *   constructor(
 *     private businessMetrics: BusinessMetricsService,
 *     private prometheusMetrics: PrometheusMetricsService,
 *   ) {}
 *
 *   async processOrder() {
 *     this.businessMetrics.recordOrderCreated('order-123');
 *   }
 *
 *   async getMetrics() {
 *     return this.prometheusMetrics.getMetrics();
 *   }
 * }
 *
 * 3. Create a /metrics endpoint in your controller:
 * @Get('metrics')
 * @Public() // if using guards
 * async getMetrics() {
 *   return await this.prometheusMetrics.getMetrics();
 * }
 *
 * 4. Initialize tracing in main.ts:
 * import { TracingService } from '@app/common';
 *
 * async function bootstrap() {
 *   await TracingService.initializeTracing(
 *     'my-service',
 *     process.env.JAEGER_ENDPOINT || 'http://localhost:4317'
 *   );
 *
 *   const app = await NestFactory.create(MyModule);
 *   // ... rest of bootstrap
 * }
 */
@Global()
@Module({
  providers: [
    LoggerService,
    PrometheusMetricsService,
    BusinessMetricsService,
    MetricsInterceptor,
    // TracingService is not provided here since it needs to be initialized
    // in main.ts before the app starts
  ],
  exports: [
    PrometheusMetricsService,
    BusinessMetricsService,
    MetricsInterceptor,
  ],
})
export class MonitoringModule implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(
    private businessMetricsService: BusinessMetricsService,
    private readonly logger: LoggerService,
  ) {}

  onApplicationBootstrap() {
    const serviceName = process.env.SERVICE_NAME || 'unknown-service';
    this.businessMetricsService.initialize(serviceName);
    this.logger.log(`📊 Monitoring enabled for service: ${serviceName}`);
  }

  async onApplicationShutdown() {
    // Gracefully shutdown tracing if initialized
    try {
      await TracingService.shutdown();
    } catch (error) {
      this.logger.warn('Tracing shutdown error (this is OK during graceful shutdown)');
    }
  }
}
